import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union
from app.database import postgres as pg

logger = logging.getLogger(__name__)


class _SkipNotice(Exception):
    """Internal: skip a notification without logging a warning."""


# Founder requests nobody answers become "expired" ("No response") after this many days.
NO_RESPONSE_DAYS = 14
_EXPIRE_EVERY_SECONDS = 300
_last_expire_run = 0.0


class InterestService:
    @staticmethod
    async def expire_stale(force: bool = False) -> int:
        """Mark founder-initiated requests with no reply in NO_RESPONSE_DAYS as expired.

        Runs when lists are read (there is no job scheduler yet), at most every few minutes."""
        import time
        global _last_expire_run
        if not force and time.monotonic() - _last_expire_run < _EXPIRE_EVERY_SECONDS:
            return 0
        _last_expire_run = time.monotonic()
        return await pg.execute(
            "UPDATE project_interests SET status = 'expired', updated_at = now() "
            "WHERE status = 'pending' AND initiated_by = 'founder' "
            f"AND created_at < now() - interval '{NO_RESPONSE_DAYS} days'"
        )

    @classmethod
    async def express_interest(
        cls,
        project_id: Union[int, str],
        investor_id: str = "investor-001",
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record an investor's introduction request and generate deal room initiation."""
        now = datetime.now(timezone.utc)

        # Lookup project for title, founder, and industry
        from app.services.project_service import ProjectService
        project = await ProjectService.get_by_id(project_id)
        if not project and ProjectService.parse_id(project_id) is None:
            raise ValueError(f"Invalid project id '{project_id}'")
        canonical_project_id = project["id"] if project else ProjectService.parse_id(project_id)
        founder_id = project.get("founder_id", "founder-001") if project else "founder-001"
        project_title = project.get("title", f"Project #{project_id}") if project else f"Project #{project_id}"
        project_industry = project.get("industry", "DeepTech") if project else "DeepTech"

        # Lookup investor details
        # Profile first, then the investor's own account (never another user's demo identity).
        investor = await pg.fetch_one(
            "SELECT p.name, p.firm, u.name AS account_name, u.organization AS account_org "
            "FROM app_users u FULL OUTER JOIN investor_profiles p ON p.user_id = u.id "
            "WHERE u.id = %s OR p.user_id = %s LIMIT 1",
            [investor_id, investor_id],
        ) or {}
        investor_name = investor.get("name") or investor.get("account_name") or "Investor"
        investor_firm = investor.get("firm") or investor.get("account_org") or "Independent investor"

        # Lookup founder details
        founder = await pg.fetch_one(
            "SELECT p.name, u.name AS account_name FROM app_users u "
            "FULL OUTER JOIN founder_profiles p ON p.user_id = u.id "
            "WHERE u.id = %s OR p.user_id = %s LIMIT 1",
            [founder_id, founder_id],
        ) or {}
        founder_name = founder.get("name") or founder.get("account_name") or "Founding Team"
        emails = await cls._account_emails([investor_id, founder_id])

        int_id = f"intro-{canonical_project_id}-{investor_id}"

        # Check if an existing interest already exists (preserve accepted status/deal room if already accepted)
        existing = await pg.fetch_one(
            "SELECT * FROM project_interests WHERE project_id = %s AND investor_id = %s",
            [canonical_project_id, investor_id],
        )
        if existing and existing.get("status") == "accepted":
            return existing
        if existing and existing.get("status") == "pending" and existing.get("initiated_by") == "founder":
            raise ValueError("This founder already asked to connect. Reply Interested or Pass in your Deal Flow.")

        doc = {
            "id": existing.get("id", int_id) if existing else int_id,
            "project_id": canonical_project_id,
            "project_title": project_title,
            "project_industry": project_industry,
            "investor_id": investor_id,
            "investor_name": investor_name,
            "investor_firm": investor_firm,
            "investor_email": emails.get(investor_id),
            "founder_id": founder_id,
            "founder_name": founder_name,
            "founder_email": emails.get(founder_id),
            "status": "pending",
            "initiated_by": "investor",
            "pass_reason": None,
            "responded_at": None,
            "message": message or "Introduction requested for confidential data room review.",
            "created_at": existing.get("created_at", now) if existing else now,
            "updated_at": now,
        }

        # Upsert by project_id and investor_id
        saved = await pg.upsert(
            "project_interests",
            doc,
            ["project_id", "investor_id"],
            update=[c for c in doc if c not in ("id", "project_id", "investor_id", "created_at")],
        )

        # Create instant notification for founder
        try:
            from app.services.notification_service import NotificationService
            from app.services.team_service import TeamService
            # Everyone on the startup's team (owner and co-founders) hears about it.
            for member_id in await TeamService.team_user_ids(canonical_project_id) or [founder_id]:
                await NotificationService.create_notification(
                    target_role="FOUNDER",
                    user_id=member_id,
                    title=f"Intro Request: {investor_name}",
                    desc=f"{investor_name} ({investor_firm}) requested an introduction for '{project_title}'.",
                    badge="Intro Request",
                    badge_variant="primary",
                    link="/founder/dashboard?tab=intros",
                )
        except Exception as e:
            logger.warning("Failed to dispatch founder intro notification: %s", e)

        # Dispatch transactional email alert to founder (only to a real address)
        try:
            if not doc["founder_email"]:
                raise ValueError("founder has no email on file")
            from app.services.email_service import EmailService
            EmailService.send_intro_request_email(
                founder_email=doc["founder_email"],
                founder_name=founder_name,
                investor_name=investor_name,
                investor_firm=investor_firm,
                project_title=project_title,
                message=message,
            )
        except Exception as e:
            logger.warning("Failed to dispatch founder intro email: %s", e)

        return saved

    @classmethod
    async def update_status(
        cls,
        interest_id: Union[int, str],
        status: str,
        response_note: Optional[str] = None,
        notify: bool = True,
        extra_fields: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update intro status to accepted or declined and unlock deal room resources.

        notify=False skips the founder-accepted-your-request messages to the investor (used when the
        investor is the one responding to a founder's request; the caller notifies the founder)."""
        now = datetime.now(timezone.utc)
        current = await cls.get_by_id(interest_id)
        if not current:
            logger.warning("Interest record %s not found for status update", interest_id)
            return None

        clean_status = status.lower().strip()
        update_fields: Dict[str, Any] = {
            "status": clean_status,
            "updated_at": now,
        }
        if response_note:
            update_fields["response_note"] = response_note
        if extra_fields:
            update_fields.update(extra_fields)

        project_id = current.get("project_id")
        project_title = current.get("project_title", "Project")
        investor_id = current.get("investor_id", "investor-001")
        investor_name = current.get("investor_name", "Investor")
        founder_name = current.get("founder_name", "Founder")

        if clean_status == "accepted":
            # Only details that really exist: the founder's account email, their profile
            # links and the project's own deck. Nothing is invented.
            founder_id = current.get("founder_id")
            p_doc = await pg.fetch_one(
                "SELECT pitch_deck_url FROM projects WHERE id = %s", [project_id]
            ) or {}
            profile = await pg.fetch_one(
                "SELECT linkedin, website FROM founder_profiles WHERE user_id = %s", [founder_id]
            ) or {}
            emails = await cls._account_emails([founder_id, investor_id])
            founder_email = emails.get(founder_id) or current.get("founder_email")
            if founder_email:
                update_fields["founder_email"] = founder_email
            if emails.get(investor_id):
                update_fields["investor_email"] = emails[investor_id]

            deal_room = {
                "unlocked": True,
                "unlocked_at": now.isoformat(),
                "founder_name": founder_name,
                "founder_email": founder_email,
                "founder_linkedin": profile.get("linkedin") or None,
                "founder_website": profile.get("website") or None,
                "pitch_deck_url": p_doc.get("pitch_deck_url") or None,
            }
            # Keep the room id if a room was already linked to this intro.
            if (current.get("deal_room") or {}).get("room_id"):
                deal_room["room_id"] = current["deal_room"]["room_id"]
            update_fields["deal_room"] = deal_room

            # Add notification for investor
            try:
                if not notify:
                    raise _SkipNotice()
                from app.services.notification_service import NotificationService
                await NotificationService.create_notification(
                    target_role="INVESTOR",
                    user_id=investor_id,
                    title=f"🎉 Deal Room Unlocked: {project_title}",
                    desc=f"{founder_name} accepted your intro request. Your private deal room and the founder's contact details are now open.",
                    badge="Deal Room",
                    badge_variant="success",
                    link="/investor/dashboard?tab=interests",
                )
            except _SkipNotice:
                pass
            except Exception as e:
                logger.warning("Failed to dispatch investor unlock notification: %s", e)

            # Dispatch transactional email alert to investor
            try:
                if not notify:
                    raise _SkipNotice()
                investor_email = update_fields.get("investor_email") or current.get("investor_email")
                if not investor_email:
                    raise ValueError("investor has no email on file")
                from app.services.email_service import EmailService
                EmailService.send_dealroom_unlocked_email(
                    investor_email=investor_email,
                    investor_name=investor_name,
                    founder_name=founder_name,
                    project_title=project_title,
                    room_id=f"room-{project_id}",
                )
            except _SkipNotice:
                pass
            except Exception as e:
                logger.warning("Failed to dispatch investor unlock email: %s", e)

        elif clean_status == "declined" and notify:
            try:
                from app.services.notification_service import NotificationService
                await NotificationService.create_notification(
                    target_role="INVESTOR",
                    user_id=investor_id,
                    title=f"Introduction Update: {project_title}",
                    desc=f"The founder respectfully declined the introduction request for {project_title} at this time.",
                    badge="Declined",
                    badge_variant="secondary",
                    link="/investor/dashboard?tab=interests",
                )
            except Exception as e:
                logger.warning("Failed to dispatch investor decline notification: %s", e)

        await pg.update_where("project_interests", update_fields, "id = %s", [current["id"]])
        return await cls.get_by_id(current["id"])

    @classmethod
    async def list_interests(
        cls,
        investor_id: Optional[str] = None,
        founder_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List introduction requests and deal rooms with enriched context."""
        await cls.expire_stale()
        where: List[str] = []
        params: List[Any] = []
        if investor_id:
            where.append("investor_id = %s")
            params.append(investor_id)
        if founder_id:
            # Intros for every startup the founder works on (as owner or co-founder).
            from app.services.team_service import TEAM_PROJECTS
            where.append(f"project_id IN {TEAM_PROJECTS}")
            params.extend([founder_id, founder_id])
        if status:
            where.append("status = %s")
            params.append(status.lower().strip())

        sql = "SELECT * FROM project_interests"
        if where:
            sql += " WHERE " + " AND ".join(where)
        docs = await pg.fetch_all(sql + " ORDER BY created_at DESC, id LIMIT 100", params)

        # Ensure legacy or minimal records have titles, names, and firms enriched
        for doc in docs:
            if not doc.get("project_title") and doc.get("project_id"):
                p = await pg.fetch_one("SELECT title, industry FROM projects WHERE id = %s", [doc["project_id"]])
                if p:
                    doc["project_title"] = p.get("title")
                    doc["project_industry"] = p.get("industry")
                else:
                    doc["project_title"] = f"Project #{doc['project_id']}"
                    doc["project_industry"] = None

            if not doc.get("investor_name"):
                inv = await pg.fetch_one(
                    "SELECT name, firm FROM investor_profiles WHERE user_id = %s",
                    [doc.get("investor_id")],
                ) or {}
                doc["investor_name"] = inv.get("name") or "Investor"
                doc["investor_firm"] = inv.get("firm") or doc.get("investor_firm")

        return docs

    @staticmethod
    async def _account_emails(user_ids: List[Optional[str]]) -> Dict[str, str]:
        """Sign-in emails for the given users (from app_users); unknown users are left out."""
        ids = [u for u in user_ids if u]
        if not ids:
            return {}
        placeholders = ", ".join(["%s"] * len(ids))
        rows = await pg.fetch_all(f"SELECT id, email FROM app_users WHERE id IN ({placeholders})", ids)
        return {r["id"]: r["email"] for r in rows if r.get("email")}

    @classmethod
    async def get_by_id(cls, interest_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        """Retrieve single interest document with deal room details."""
        return await pg.fetch_one("SELECT * FROM project_interests WHERE id = %s", [str(interest_id)])

    @classmethod
    async def link_deal_room(cls, interest_id: Union[int, str], room_id: str) -> Optional[Dict[str, Any]]:
        """Record the deal room id on the intro so dashboards can open it."""
        await pg.execute(
            "UPDATE project_interests SET deal_room = COALESCE(deal_room, '{}'::jsonb) || %s, updated_at = now() "
            "WHERE id = %s",
            [pg.Jsonb({"room_id": room_id}), str(interest_id)],
        )
        return await cls.get_by_id(interest_id)

    @classmethod
    async def delete_interest(cls, interest_id: Union[int, str]) -> bool:
        """Withdraw/remove an introduction request."""
        deleted = await pg.execute("DELETE FROM project_interests WHERE id = %s", [str(interest_id)])
        return deleted > 0
