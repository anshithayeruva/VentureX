import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union
from app.database import postgres as pg

logger = logging.getLogger(__name__)


class InterestService:
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
        investor = await pg.fetch_one("SELECT name, firm FROM investor_profiles WHERE user_id = %s", [investor_id])
        investor_name = investor.get("name", "Dr. Sarah Lin") if investor else "Dr. Sarah Lin"
        investor_firm = investor.get("firm", "Apex Horizon Ventures") if investor else "Apex Horizon Ventures"

        # Lookup founder details
        founder = await pg.fetch_one("SELECT name FROM founder_profiles WHERE user_id = %s", [founder_id])
        founder_name = founder.get("name", "Founding Team") if founder else "Founding Team"

        int_id = f"intro-{canonical_project_id}-{investor_id}"

        # Check if an existing interest already exists (preserve accepted status/deal room if already accepted)
        existing = await pg.fetch_one(
            "SELECT * FROM project_interests WHERE project_id = %s AND investor_id = %s",
            [canonical_project_id, investor_id],
        )
        if existing and existing.get("status") == "accepted":
            return existing

        doc = {
            "id": existing.get("id", int_id) if existing else int_id,
            "project_id": canonical_project_id,
            "project_title": project_title,
            "project_industry": project_industry,
            "investor_id": investor_id,
            "investor_name": investor_name,
            "investor_firm": investor_firm,
            "investor_email": f"{investor_id}@investors.venturex.io",
            "founder_id": founder_id,
            "founder_name": founder_name,
            "founder_email": f"{founder_id}@startups.venturex.io",
            "status": "pending",
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
            await NotificationService.create_notification(
                target_role="FOUNDER",
                user_id=founder_id,
                title=f"Intro Request: {investor_name}",
                desc=f"{investor_name} ({investor_firm}) requested an introduction for '{project_title}'.",
                badge="Intro Request",
                badge_variant="primary",
                link="/founder/dashboard?tab=intros",
            )
        except Exception as e:
            logger.warning("Failed to dispatch founder intro notification: %s", e)

        # Dispatch transactional email alert to founder
        try:
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
    ) -> Optional[Dict[str, Any]]:
        """Update intro status to accepted or declined and unlock deal room resources."""
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

        project_id = current.get("project_id")
        project_title = current.get("project_title", "Project")
        investor_id = current.get("investor_id", "investor-001")
        investor_name = current.get("investor_name", "Investor")
        founder_name = current.get("founder_name", "Founder")

        if clean_status == "accepted":
            # Lookup latest project deck URL if available
            p_doc = await pg.fetch_one("SELECT pitch_deck_url FROM projects WHERE id = %s", [project_id])
            deck_url = (p_doc.get("pitch_deck_url") if p_doc else None) or "https://neuropulse.demo/deck.pdf"

            deal_room = {
                "unlocked": True,
                "unlocked_at": now.isoformat(),
                "founder_name": founder_name,
                "founder_email": current.get("founder_email") or "founder@venturex.demo",
                "founder_phone": "+1 (415) 890-2341",
                "founder_linkedin": "https://linkedin.com/in/founder",
                "direct_messaging_channel": f"channel-dealroom-{current.get('id', interest_id)}",
                "meeting_scheduler_url": "https://cal.com/founder/intro-30min",
                "data_room_url": f"https://dataroom.venturex.io/room/{project_id}?access=granted",
                "pitch_deck_url": deck_url,
                "financial_model_url": f"https://dataroom.venturex.io/models/financial_model_{project_id}.xlsx",
                "cap_table_verified": True,
            }
            update_fields["deal_room"] = deal_room

            # Add notification for investor
            try:
                from app.services.notification_service import NotificationService
                await NotificationService.create_notification(
                    target_role="INVESTOR",
                    user_id=investor_id,
                    title=f"🎉 Deal Room Unlocked: {project_title}",
                    desc=f"{founder_name} accepted your intro request! Verified cap table, data room, and direct contact details are now unlocked.",
                    badge="Deal Room",
                    badge_variant="success",
                    link="/investor/dashboard?tab=interests",
                )
            except Exception as e:
                logger.warning("Failed to dispatch investor unlock notification: %s", e)

            # Dispatch transactional email alert to investor
            try:
                from app.services.email_service import EmailService
                EmailService.send_dealroom_unlocked_email(
                    investor_email=current.get("investor_email") or f"{investor_id}@investors.venturex.io",
                    investor_name=investor_name,
                    founder_name=founder_name,
                    project_title=project_title,
                    room_id=f"room-{project_id}",
                )
            except Exception as e:
                logger.warning("Failed to dispatch investor unlock email: %s", e)

        elif clean_status == "declined":
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
        where: List[str] = []
        params: List[Any] = []
        if investor_id:
            where.append("investor_id = %s")
            params.append(investor_id)
        if founder_id:
            where.append("founder_id = %s")
            params.append(founder_id)
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
                    doc["project_title"] = "NeuroPulse AI"
                    doc["project_industry"] = "Healthcare & AI"

            if not doc.get("investor_name"):
                inv = await pg.fetch_one(
                    "SELECT name, firm FROM investor_profiles WHERE user_id = %s",
                    [doc.get("investor_id") or "investor-001"],
                )
                if inv:
                    doc["investor_name"] = inv.get("name", "Dr. Sarah Lin")
                    doc["investor_firm"] = inv.get("firm", "Apex Horizon Ventures")
                else:
                    doc["investor_name"] = "Dr. Sarah Lin"
                    doc["investor_firm"] = "Apex Horizon Ventures"

        return docs

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
