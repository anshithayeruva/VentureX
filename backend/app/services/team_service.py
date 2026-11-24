"""Teams: co-founders who share a startup, partners in an investor firm, and the email invitations
that bring people in.

Startup teams: the project's creator is the owner; co-founders can do everything on the project
(edit, publish, readiness, materials, intros, deal rooms, updates, verification) except manage the
team. Firm teams: one firm per investor; admins invite and remove partners; partners see the firm's
shared pipeline. Invitations are addressed to an email and accepted by the signed-in account with that
(verified) email.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.database import postgres as pg

logger = logging.getLogger(__name__)

# Projects a user works on: ones they created plus ones they're a co-founder on (2 params: user id twice).
TEAM_PROJECTS = "(SELECT id FROM projects WHERE founder_id = %s UNION SELECT project_id FROM project_members WHERE user_id = %s)"

INVITE_DAYS = 14
MAX_PROJECT_MEMBERS = 10
MAX_FIRM_MEMBERS = 50


class TeamError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "invalid"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_email(email: str) -> str:
    email = (email or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1] or len(email) > 254:
        raise TeamError("Enter a valid email address.", 422, "bad_email")
    return email


class TeamService:
    # ------------------------------------------------------------------ access helpers (startups)

    @staticmethod
    async def project_ids(user_id: str) -> List[int]:
        rows = await pg.fetch_all(TEAM_PROJECTS.strip("()"), [user_id, user_id])
        return [r["id"] for r in rows]

    @staticmethod
    async def is_member(user_id: str, project_id: int) -> bool:
        return bool(await pg.fetch_val(
            "SELECT EXISTS (SELECT 1 FROM project_members WHERE project_id = %s AND user_id = %s)",
            [project_id, user_id]))

    @classmethod
    async def can_work_on(cls, user_id: Optional[str], project: Optional[Dict[str, Any]]) -> bool:
        """The project's owner or one of its co-founders."""
        if not user_id or not project:
            return False
        return project.get("founder_id") == user_id or await cls.is_member(user_id, project["id"])

    @staticmethod
    async def team_user_ids(project_id: int) -> List[str]:
        rows = await pg.fetch_all(
            "SELECT founder_id AS user_id FROM projects WHERE id = %s UNION SELECT user_id FROM project_members WHERE project_id = %s",
            [project_id, project_id])
        return [r["user_id"] for r in rows]

    # ------------------------------------------------------------------ startup teams

    @classmethod
    async def project_team(cls, user_id: str, project_id: int) -> Dict[str, Any]:
        project = await pg.fetch_one("SELECT id, title, founder_id FROM projects WHERE id = %s", [project_id])
        if not await cls.can_work_on(user_id, project):
            raise TeamError("Project not found.", 404, "not_found")
        people = await pg.fetch_all(
            """
            SELECT x.user_id, x.role, x.created_at, u.email,
                   COALESCE(NULLIF(f.name, ''), u.name, u.email) AS name
            FROM (
                SELECT founder_id AS user_id, 'owner' AS role, created_at FROM projects WHERE id = %s
                UNION ALL
                SELECT user_id, role, created_at FROM project_members WHERE project_id = %s
            ) x
            LEFT JOIN app_users u ON u.id = x.user_id LEFT JOIN founder_profiles f ON f.user_id = x.user_id
            ORDER BY (x.role = 'owner') DESC, x.created_at
            """, [project_id, project_id])
        is_owner = project["founder_id"] == user_id
        invites = await pg.fetch_all(
            "SELECT id, email, role, created_at, expires_at FROM team_invitations "
            "WHERE kind = 'project' AND project_id = %s AND status = 'pending' AND expires_at > now() ORDER BY created_at",
            [project_id]) if is_owner else []
        return {"project": {"id": project["id"], "title": project["title"]}, "members": people,
                "invitations": invites, "can_manage": is_owner, "you": user_id}

    @classmethod
    async def invite_to_project(cls, user_id: str, project_id: int, email: str) -> Dict[str, Any]:
        project = await pg.fetch_one("SELECT id, title, founder_id FROM projects WHERE id = %s", [project_id])
        if not project or project["founder_id"] != user_id:
            raise TeamError("Only the project's owner can invite co-founders.", 403, "owner_only")
        email = _clean_email(email)
        existing = await pg.fetch_val(
            "SELECT EXISTS (SELECT 1 FROM app_users u WHERE lower(u.email) = %s AND (u.id = %s OR u.id IN "
            "(SELECT user_id FROM project_members WHERE project_id = %s)))", [email, project["founder_id"], project_id])
        if existing:
            raise TeamError("They're already on this team.", 409, "already_member")
        count = await pg.fetch_val("SELECT count(*) FROM project_members WHERE project_id = %s", [project_id])
        if int(count or 0) >= MAX_PROJECT_MEMBERS:
            raise TeamError(f"A startup can have up to {MAX_PROJECT_MEMBERS} co-founders.", 422, "team_full")
        return await cls._invite("project", email, "cofounder", user_id, project_id=project_id, label=project["title"])

    @classmethod
    async def remove_project_member(cls, user_id: str, project_id: int, member_id: str) -> None:
        """The owner removes a co-founder, or a co-founder leaves."""
        project = await pg.fetch_one("SELECT id, founder_id FROM projects WHERE id = %s", [project_id])
        if not await cls.can_work_on(user_id, project):
            raise TeamError("Project not found.", 404, "not_found")
        if member_id == project["founder_id"]:
            raise TeamError("The owner can't be removed from their project.", 422, "owner")
        if user_id != project["founder_id"] and user_id != member_id:
            raise TeamError("Only the owner can remove co-founders.", 403, "owner_only")
        if not await pg.execute("DELETE FROM project_members WHERE project_id = %s AND user_id = %s", [project_id, member_id]):
            raise TeamError("They aren't on this team.", 404, "not_member")

    # ------------------------------------------------------------------ firms

    @staticmethod
    async def firm_of(user_id: str) -> Optional[Dict[str, Any]]:
        return await pg.fetch_one(
            "SELECT f.*, m.role AS my_role FROM firm_members m JOIN firms f ON f.id = m.firm_id WHERE m.user_id = %s",
            [user_id])

    @staticmethod
    async def partner_ids(user_id: str) -> List[str]:
        """Other members of the investor's firm."""
        rows = await pg.fetch_all(
            "SELECT o.user_id FROM firm_members me JOIN firm_members o ON o.firm_id = me.firm_id "
            "WHERE me.user_id = %s AND o.user_id <> %s", [user_id, user_id])
        return [r["user_id"] for r in rows]

    @classmethod
    async def my_firm(cls, user_id: str) -> Dict[str, Any]:
        firm = await cls.firm_of(user_id)
        if not firm:
            return {"firm": None, "members": [], "invitations": [], "is_admin": False}
        members = await pg.fetch_all(
            """
            SELECT m.user_id, m.role, m.created_at, u.email, COALESCE(NULLIF(p.name, ''), u.name, u.email) AS name,
                   p.title, COALESCE(p.verification_status, 'unverified') AS verification_status
            FROM firm_members m LEFT JOIN app_users u ON u.id = m.user_id
            LEFT JOIN investor_profiles p ON p.user_id = m.user_id
            WHERE m.firm_id = %s ORDER BY (m.role = 'admin') DESC, m.created_at
            """, [firm["id"]])
        is_admin = firm["my_role"] == "admin"
        invites = await pg.fetch_all(
            "SELECT id, email, role, created_at, expires_at FROM team_invitations "
            "WHERE kind = 'firm' AND firm_id = %s AND status = 'pending' AND expires_at > now() ORDER BY created_at",
            [firm["id"]]) if is_admin else []
        return {"firm": {k: firm[k] for k in ("id", "name", "website", "created_at")}, "members": members,
                "invitations": invites, "is_admin": is_admin, "you": user_id}

    @classmethod
    async def create_firm(cls, user_id: str, name: str, website: str) -> Dict[str, Any]:
        if await cls.firm_of(user_id):
            raise TeamError("You're already in a firm. Leave it first to start another.", 409, "already_in_firm")
        firm = await pg.insert("firms", {"name": name.strip(), "website": (website or "").strip(), "created_by": user_id})
        await pg.insert("firm_members", {"firm_id": firm["id"], "user_id": user_id, "role": "admin"}, returning=False)
        await cls._sync_profile_firm(user_id, firm["name"])
        return await cls.my_firm(user_id)

    @classmethod
    async def update_firm(cls, user_id: str, name: str, website: str) -> Dict[str, Any]:
        firm = await cls._admin_firm(user_id)
        await pg.update_where("firms", {"name": name.strip(), "website": (website or "").strip(), "updated_at": _now()},
                              "id = %s", [firm["id"]])
        for m in await pg.fetch_all("SELECT user_id FROM firm_members WHERE firm_id = %s", [firm["id"]]):
            await cls._sync_profile_firm(m["user_id"], name.strip())
        return await cls.my_firm(user_id)

    @classmethod
    async def _admin_firm(cls, user_id: str) -> Dict[str, Any]:
        firm = await cls.firm_of(user_id)
        if not firm:
            raise TeamError("You aren't in a firm.", 404, "no_firm")
        if firm["my_role"] != "admin":
            raise TeamError("Only the firm's admins can do this.", 403, "admin_only")
        return firm

    @classmethod
    async def invite_to_firm(cls, user_id: str, email: str, role: str) -> Dict[str, Any]:
        firm = await cls._admin_firm(user_id)
        email = _clean_email(email)
        if await pg.fetch_val(
            "SELECT EXISTS (SELECT 1 FROM firm_members m JOIN app_users u ON u.id = m.user_id "
            "WHERE m.firm_id = %s AND lower(u.email) = %s)", [firm["id"], email]):
            raise TeamError("They're already in your firm.", 409, "already_member")
        count = await pg.fetch_val("SELECT count(*) FROM firm_members WHERE firm_id = %s", [firm["id"]])
        if int(count or 0) >= MAX_FIRM_MEMBERS:
            raise TeamError(f"A firm can have up to {MAX_FIRM_MEMBERS} members.", 422, "team_full")
        return await cls._invite("firm", email, role, user_id, firm_id=firm["id"], label=firm["name"])

    @classmethod
    async def remove_firm_member(cls, user_id: str, member_id: str) -> None:
        """An admin removes a partner, or anyone leaves. The firm needs an admin while it has members."""
        firm = await cls.firm_of(user_id)
        if not firm:
            raise TeamError("You aren't in a firm.", 404, "no_firm")
        if member_id != user_id and firm["my_role"] != "admin":
            raise TeamError("Only the firm's admins can remove partners.", 403, "admin_only")
        target = await pg.fetch_one("SELECT role FROM firm_members WHERE firm_id = %s AND user_id = %s", [firm["id"], member_id])
        if not target:
            raise TeamError("They aren't in your firm.", 404, "not_member")
        members = await pg.fetch_all("SELECT user_id, role FROM firm_members WHERE firm_id = %s", [firm["id"]])
        admins = [m for m in members if m["role"] == "admin"]
        if target["role"] == "admin" and len(admins) == 1 and len(members) > 1:
            raise TeamError("Make another partner an admin before the last admin leaves.", 422, "last_admin")
        await pg.execute("DELETE FROM firm_members WHERE firm_id = %s AND user_id = %s", [firm["id"], member_id])
        if len(members) == 1:
            await pg.execute("DELETE FROM firms WHERE id = %s", [firm["id"]])  # nobody left

    @classmethod
    async def set_firm_role(cls, user_id: str, member_id: str, role: str) -> Dict[str, Any]:
        firm = await cls._admin_firm(user_id)
        if member_id == user_id and role != "admin":
            admins = await pg.fetch_val("SELECT count(*) FROM firm_members WHERE firm_id = %s AND role = 'admin'", [firm["id"]])
            if int(admins or 0) <= 1:
                raise TeamError("Make another partner an admin first.", 422, "last_admin")
        if not await pg.execute("UPDATE firm_members SET role = %s WHERE firm_id = %s AND user_id = %s",
                                [role, firm["id"], member_id]):
            raise TeamError("They aren't in your firm.", 404, "not_member")
        return await cls.my_firm(user_id)

    @staticmethod
    async def _sync_profile_firm(user_id: str, name: str) -> None:
        """Members show the firm's name on their investor profile."""
        await pg.execute("UPDATE investor_profiles SET firm = %s, updated_at = now() WHERE user_id = %s", [name, user_id])

    @classmethod
    async def firm_pipeline(cls, user_id: str) -> Dict[str, Any]:
        """Every startup any partner is pursuing, with who and how far (no messages or private notes)."""
        firm = await cls.firm_of(user_id)
        if not firm:
            raise TeamError("You aren't in a firm.", 404, "no_firm")
        rows = await pg.fetch_all(
            """
            SELECT i.project_id, COALESCE(p.title, i.project_title) AS title, p.industry, p.stage,
                   i.investor_id AS member_id, COALESCE(NULLIF(ip.name, ''), u.name, u.email) AS member_name,
                   i.status AS intro_status, i.initiated_by, i.updated_at, d.stage AS deal_stage,
                   (inv.id IS NOT NULL) AS invested
            FROM project_interests i
            JOIN firm_members m ON m.user_id = i.investor_id AND m.firm_id = %s
            LEFT JOIN projects p ON p.id = i.project_id
            LEFT JOIN app_users u ON u.id = i.investor_id LEFT JOIN investor_profiles ip ON ip.user_id = i.investor_id
            LEFT JOIN LATERAL (SELECT stage FROM deal_rooms WHERE project_id = i.project_id AND investor_id = i.investor_id
                               ORDER BY updated_at DESC LIMIT 1) d ON TRUE
            LEFT JOIN LATERAL (SELECT id FROM investments WHERE project_id = i.project_id AND investor_id = i.investor_id
                               LIMIT 1) inv ON TRUE
            ORDER BY i.updated_at DESC LIMIT 300
            """, [firm["id"]])
        return {"firm": {"id": firm["id"], "name": firm["name"]}, "items": rows}

    @staticmethod
    async def partner_activity(user_id: str, project_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
        """For these startups: which of your partners already asked for an intro or are in a deal room."""
        ids = [int(i) for i in project_ids if i is not None]
        if not ids:
            return {}
        rows = await pg.fetch_all(
            """
            SELECT i.project_id, COALESCE(NULLIF(ip.name, ''), u.name, 'A partner') AS name, i.status, i.initiated_by
            FROM firm_members me JOIN firm_members o ON o.firm_id = me.firm_id AND o.user_id <> me.user_id
            JOIN project_interests i ON i.investor_id = o.user_id
            LEFT JOIN app_users u ON u.id = o.user_id LEFT JOIN investor_profiles ip ON ip.user_id = o.user_id
            WHERE me.user_id = %s AND i.project_id = ANY(%s::bigint[]) AND i.status IN ('pending', 'accepted')
            """, [user_id, "{" + ",".join(str(i) for i in ids) + "}"])
        out: Dict[int, List[Dict[str, Any]]] = {}
        for r in rows:
            out.setdefault(r["project_id"], []).append({"name": r["name"], "status": r["status"], "initiated_by": r["initiated_by"]})
        return out

    @staticmethod
    async def firm_partners_public(investor_id: str) -> List[Dict[str, Any]]:
        """Partners shown on an investor's public profile (names and titles only)."""
        return await pg.fetch_all(
            """
            SELECT o.user_id AS investor_id, COALESCE(NULLIF(p.name, ''), u.name, 'Partner') AS name, COALESCE(p.title, '') AS title
            FROM firm_members me JOIN firm_members o ON o.firm_id = me.firm_id AND o.user_id <> me.user_id
            LEFT JOIN app_users u ON u.id = o.user_id LEFT JOIN investor_profiles p ON p.user_id = o.user_id
            WHERE me.user_id = %s ORDER BY name
            """, [investor_id])

    # ------------------------------------------------------------------ invitations

    @classmethod
    async def _invite(cls, kind: str, email: str, role: str, invited_by: str, project_id: Optional[int] = None,
                      firm_id: Optional[int] = None, label: str = "") -> Dict[str, Any]:
        # A new invite to the same place replaces an older pending one.
        await pg.execute(
            "UPDATE team_invitations SET status = 'revoked', responded_at = now() WHERE kind = %s AND lower(email) = %s "
            "AND status = 'pending' AND (project_id IS NOT DISTINCT FROM %s) AND (firm_id IS NOT DISTINCT FROM %s)",
            [kind, email, project_id, firm_id])
        invite = await pg.insert("team_invitations", {
            "id": secrets.token_urlsafe(24), "kind": kind, "project_id": project_id, "firm_id": firm_id, "email": email,
            "role": role, "invited_by": invited_by, "expires_at": _now() + timedelta(days=INVITE_DAYS),
        })
        inviter = await pg.fetch_one("SELECT name, email FROM app_users WHERE id = %s", [invited_by]) or {}
        inviter_name = inviter.get("name") or inviter.get("email") or "A teammate"
        try:
            from app.services.email_service import EmailService
            EmailService.send_team_invite_email(email, inviter_name, kind, label, invite["id"], INVITE_DAYS)
        except Exception as e:
            logger.warning("Could not email invitation %s: %s", invite["id"], e)
        invitee = await pg.fetch_val("SELECT id FROM app_users WHERE lower(email) = %s", [email])
        if invitee:
            try:
                from app.services.notification_service import NotificationService
                what = f"join {label} as a co-founder" if kind == "project" else f"join {label} as a {role}"
                await NotificationService.create_notification(
                    category="account",
                    target_role="FOUNDER" if kind == "project" else "INVESTOR", user_id=invitee,
                    title=f"{inviter_name} invited you to {what}"[:200], desc="Accept or decline the invitation.",
                    badge="Invitation", badge_variant="primary", link=f"/invite/{invite['id']}",
                )
            except Exception as e:
                logger.warning("Could not notify invitee for %s: %s", invite["id"], e)
        return {k: invite[k] for k in ("id", "email", "role", "created_at", "expires_at")}

    @classmethod
    async def revoke(cls, user_id: str, invite_id: str) -> None:
        inv = await pg.fetch_one("SELECT * FROM team_invitations WHERE id = %s", [invite_id])
        if not inv or inv["status"] != "pending":
            raise TeamError("Invitation not found.", 404, "not_found")
        if inv["kind"] == "project":
            owner = await pg.fetch_val("SELECT founder_id FROM projects WHERE id = %s", [inv["project_id"]])
            allowed = owner == user_id
        else:
            firm = await cls.firm_of(user_id)
            allowed = bool(firm and firm["id"] == inv["firm_id"] and firm["my_role"] == "admin")
        if not allowed:
            raise TeamError("Invitation not found.", 404, "not_found")
        await pg.execute("UPDATE team_invitations SET status = 'revoked', responded_at = now() WHERE id = %s", [invite_id])

    @staticmethod
    async def _describe(inv: Dict[str, Any]) -> Dict[str, Any]:
        inviter = await pg.fetch_one("SELECT name, email FROM app_users WHERE id = %s", [inv["invited_by"]]) or {}
        if inv["kind"] == "project":
            target = await pg.fetch_one("SELECT title AS name FROM projects WHERE id = %s", [inv["project_id"]]) or {}
        else:
            target = await pg.fetch_one("SELECT name FROM firms WHERE id = %s", [inv["firm_id"]]) or {}
        return {
            "id": inv["id"], "kind": inv["kind"], "role": inv["role"], "status": inv["status"],
            "target_name": target.get("name") or "a team", "invited_by": inviter.get("name") or inviter.get("email"),
            "expires_at": inv["expires_at"], "email": inv["email"],
            "expired": inv["expires_at"] < _now(),
        }

    @classmethod
    async def my_invitations(cls, email: str) -> List[Dict[str, Any]]:
        rows = await pg.fetch_all(
            "SELECT * FROM team_invitations WHERE lower(email) = %s AND status = 'pending' AND expires_at > now() "
            "ORDER BY created_at DESC", [email.lower()])
        return [await cls._describe(r) for r in rows]

    @classmethod
    async def invitation(cls, email: str, invite_id: str) -> Dict[str, Any]:
        inv = await pg.fetch_one("SELECT * FROM team_invitations WHERE id = %s", [invite_id])
        if not inv:
            raise TeamError("This invitation doesn't exist or was withdrawn.", 404, "not_found")
        out = await cls._describe(inv)
        out["for_you"] = inv["email"].lower() == (email or "").lower()
        if not out["for_you"]:
            local, _, domain = inv["email"].partition("@")
            out["email"] = local[:2] + "•" * max(1, len(local) - 2) + "@" + domain
        return out

    @classmethod
    async def respond(cls, user, invite_id: str, accept: bool) -> Dict[str, Any]:
        inv = await pg.fetch_one("SELECT * FROM team_invitations WHERE id = %s", [invite_id])
        if not inv or inv["email"].lower() != (user.email or "").lower():
            raise TeamError("This invitation isn't for your account. Sign in with the email it was sent to.", 404, "not_yours")
        if inv["status"] != "pending":
            raise TeamError(f"This invitation was already {inv['status']}.", 409, "not_pending")
        if inv["expires_at"] < _now():
            raise TeamError("This invitation has expired. Ask for a new one.", 410, "expired")
        if accept and not user.email_verified:
            raise TeamError("Verify your email address first.", 403, "email_unverified")
        if not accept:
            await pg.execute("UPDATE team_invitations SET status = 'declined', responded_at = now() WHERE id = %s", [invite_id])
            return {"status": "declined"}

        needed = "FOUNDER" if inv["kind"] == "project" else "INVESTOR"
        if user.role and user.role != needed:
            raise TeamError(f"This invitation is for a {needed.lower()} account, and yours is a {user.role.lower()} account.",
                            409, "wrong_role")
        if not user.role:
            # Invited before choosing a workspace: the invitation decides it.
            await pg.execute("UPDATE app_users SET role = %s, updated_at = now() WHERE id = %s", [needed, user.id])
            if needed == "FOUNDER":
                from app.services.founder_service import FounderService
                await FounderService.get_or_create_profile(user.id)
            else:
                from app.services.investor_service import InvestorService
                await InvestorService.get_or_create_profile(user.id)

        if inv["kind"] == "project":
            owner = await pg.fetch_val("SELECT founder_id FROM projects WHERE id = %s", [inv["project_id"]])
            if owner is None:
                raise TeamError("That startup no longer exists.", 410, "gone")
            if owner != user.id:
                await pg.upsert("project_members", {"project_id": inv["project_id"], "user_id": user.id,
                                                     "role": "cofounder", "added_by": inv["invited_by"]},
                                ["project_id", "user_id"], update=[])
            target = {"kind": "project", "project_id": inv["project_id"]}
        else:
            current = await cls.firm_of(user.id)
            if current and current["id"] != inv["firm_id"]:
                raise TeamError(f"You're in {current['name']}. Leave it before joining another firm.", 409, "already_in_firm")
            if not current:
                await pg.insert("firm_members", {"firm_id": inv["firm_id"], "user_id": user.id, "role": inv["role"]},
                                returning=False)
            name = await pg.fetch_val("SELECT name FROM firms WHERE id = %s", [inv["firm_id"]])
            from app.services.investor_service import InvestorService
            await InvestorService.get_or_create_profile(user.id)
            await cls._sync_profile_firm(user.id, name)
            target = {"kind": "firm", "firm_id": inv["firm_id"]}
        await pg.execute("UPDATE team_invitations SET status = 'accepted', accepted_by = %s, responded_at = now() WHERE id = %s",
                         [user.id, invite_id])
        try:
            from app.services.notification_service import NotificationService
            await NotificationService.create_notification(
                category="account",
                target_role="FOUNDER" if inv["kind"] == "project" else "INVESTOR", user_id=inv["invited_by"],
                title=f"{user.name or user.email} joined your team", desc="Your invitation was accepted.",
                badge="Team", badge_variant="success",
                link=f"/founder/projects/{inv['project_id']}" if inv["kind"] == "project" else "/investor/firm",
            )
        except Exception as e:
            logger.warning("Could not notify inviter for %s: %s", invite_id, e)
        return {"status": "accepted", **target}
