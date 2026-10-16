import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union
from bson import ObjectId
from app.database.mongodb import get_database
from app.database.utils import serialize_doc, serialize_docs

logger = logging.getLogger(__name__)


class InterestService:
    @classmethod
    async def _seed_initial_interests_if_empty(cls, db) -> None:
        """Seed initial introduction requests so the deal room workflow is immediately interactive."""
        count = await db.project_interests.count_documents({})
        if count > 0:
            return

        now = datetime.now(timezone.utc)
        initial_interests = [
            {
                "id": "intro-001",
                "project_id": 1,
                "project_title": "NeuroPulse AI",
                "project_industry": "Healthcare & AI",
                "investor_id": "investor-001",
                "investor_name": "Dr. Sarah Lin",
                "investor_firm": "Apex Horizon Ventures",
                "investor_email": "sarah.lin@apexhorizon.vc",
                "founder_id": "founder-001",
                "founder_name": "Alex Rivers",
                "founder_email": "alex@neuropulse.demo",
                "status": "pending",
                "message": (
                    "We've tracked your clinical ICU telemetry validation and would love to review your "
                    "confidential regulatory roadmap and discuss participating as lead in your $750k Seed round."
                ),
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "intro-002",
                "project_id": 1,
                "project_title": "NeuroPulse AI",
                "project_industry": "Healthcare & AI",
                "investor_id": "investor-002",
                "investor_name": "Marcus Sterling",
                "investor_firm": "BlueShift Capital",
                "investor_email": "m.sterling@blueshiftcap.com",
                "founder_id": "founder-001",
                "founder_name": "Alex Rivers",
                "founder_email": "alex@neuropulse.demo",
                "status": "accepted",
                "message": "Highly interested in your edge neural processor architecture. Requesting deal room dialogue.",
                "response_note": "Welcome Marcus. Excited to connect and share our pilot hospital data room.",
                "deal_room": {
                    "unlocked": True,
                    "unlocked_at": now.isoformat(),
                    "founder_name": "Alex Rivers",
                    "founder_email": "alex@neuropulse.demo",
                    "founder_phone": "+1 (415) 890-2341",
                    "founder_linkedin": "https://linkedin.com/in/alexrivers",
                    "direct_messaging_channel": "channel-dealroom-intro-002",
                    "meeting_scheduler_url": "https://cal.com/alexrivers/seed-intro-30min",
                    "data_room_url": "https://dataroom.venturex.io/room/1?access=verified_partner",
                    "pitch_deck_url": "https://neuropulse.demo/deck.pdf",
                    "financial_model_url": "https://dataroom.venturex.io/models/neuropulse_financial_model.xlsx",
                    "cap_table_verified": True,
                },
                "created_at": now,
                "updated_at": now,
            },
        ]
        await db.project_interests.insert_many(initial_interests)
        logger.info("Seeded initial project interests with deal rooms into MongoDB Atlas.")

    @classmethod
    def _parse_id(cls, interest_id: Union[int, str]) -> Dict[str, Any]:
        """Generate a filter matching custom string id or ObjectId."""
        queries = [{"id": interest_id}]
        try:
            queries.append({"id": int(interest_id)})
        except (ValueError, TypeError):
            pass
        try:
            queries.append({"id": str(interest_id)})
        except Exception:
            pass
        if ObjectId.is_valid(str(interest_id)):
            queries.append({"_id": ObjectId(str(interest_id))})
        return {"$or": queries} if len(queries) > 1 else queries[0]

    @classmethod
    async def express_interest(
        cls,
        project_id: Union[int, str],
        investor_id: str = "investor-001",
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record an investor's introduction request and generate deal room initiation."""
        db = get_database()
        if db is None:
            raise RuntimeError("Database unavailable")

        now = datetime.now(timezone.utc)

        # Lookup project for title, founder, and industry
        p_query = {"$or": [{"id": project_id}]}
        try:
            p_query["$or"].append({"id": int(project_id)})
        except ValueError:
            pass
        try:
            p_query["$or"].append({"id": str(project_id)})
        except Exception:
            pass
        if ObjectId.is_valid(str(project_id)):
            p_query["$or"].append({"_id": ObjectId(str(project_id))})

        project = await db.projects.find_one(p_query)
        founder_id = project.get("founder_id", "founder-001") if project else "founder-001"
        project_title = project.get("title", f"Project #{project_id}") if project else f"Project #{project_id}"
        project_industry = project.get("industry", "DeepTech") if project else "DeepTech"

        # Lookup investor details
        investor = await db.investor_profiles.find_one({"user_id": investor_id})
        investor_name = investor.get("name", "Angel Investor") if investor else "Angel Investor"
        investor_firm = investor.get("firm", "Venture Syndicate") if investor else "Venture Syndicate"

        # Lookup founder details
        founder = await db.founder_profiles.find_one({"user_id": founder_id})
        founder_name = founder.get("name", "Founding Team") if founder else "Founding Team"

        int_id = f"intro-{project_id}-{investor_id}"

        doc = {
            "id": int_id,
            "project_id": project_id,
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
            "created_at": now,
            "updated_at": now,
        }

        # Upsert by project_id and investor_id
        await db.project_interests.update_one(
            {"project_id": project_id, "investor_id": investor_id},
            {"$set": doc},
            upsert=True
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

        saved = await db.project_interests.find_one({"project_id": project_id, "investor_id": investor_id})
        return serialize_doc(saved)

    @classmethod
    async def update_status(
        cls,
        interest_id: Union[int, str],
        status: str,
        response_note: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update intro status to accepted or declined and unlock deal room resources."""
        db = get_database()
        if db is None:
            return None

        now = datetime.now(timezone.utc)
        query = cls._parse_id(interest_id)
        current = await db.project_interests.find_one(query)
        if not current:
            # Fallback query by string ID in case field was saved as string id
            current = await db.project_interests.find_one({"id": str(interest_id)})
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
            p_doc = await db.projects.find_one({"$or": [{"id": project_id}, {"id": str(project_id)}]})
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

        await db.project_interests.update_one({"_id": current["_id"]}, {"$set": update_fields})
        updated = await db.project_interests.find_one({"_id": current["_id"]})
        return serialize_doc(updated)

    @classmethod
    async def list_interests(
        cls,
        investor_id: Optional[str] = None,
        founder_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List introduction requests and deal rooms with enriched context."""
        db = get_database()
        if db is None:
            return []

        # Auto-seed sample interests if database is empty
        await cls._seed_initial_interests_if_empty(db)

        query: Dict[str, Any] = {}
        if investor_id:
            query["investor_id"] = investor_id
        if founder_id:
            query["founder_id"] = founder_id
        if status:
            query["status"] = status.lower().strip()

        cursor = db.project_interests.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=100)

        # Ensure legacy or minimal records have titles, names, and firms enriched
        for doc in docs:
            if not doc.get("project_title") and doc.get("project_id"):
                p = await db.projects.find_one({"$or": [{"id": doc["project_id"]}, {"id": str(doc["project_id"])}]})
                if p:
                    doc["project_title"] = p.get("title")
                    doc["project_industry"] = p.get("industry")
                else:
                    doc["project_title"] = "NeuroPulse AI"
                    doc["project_industry"] = "Healthcare & AI"

            if not doc.get("investor_name"):
                inv = await db.investor_profiles.find_one({"user_id": doc.get("investor_id", "investor-001")})
                if inv:
                    doc["investor_name"] = inv.get("name", "Dr. Sarah Lin")
                    doc["investor_firm"] = inv.get("firm", "Apex Horizon Ventures")
                else:
                    doc["investor_name"] = "Dr. Sarah Lin"
                    doc["investor_firm"] = "Apex Horizon Ventures"

        return serialize_docs(docs)

    @classmethod
    async def get_by_id(cls, interest_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        """Retrieve single interest document with deal room details."""
        db = get_database()
        if db is None:
            return None

        query = cls._parse_id(interest_id)
        doc = await db.project_interests.find_one(query)
        if not doc:
            doc = await db.project_interests.find_one({"id": str(interest_id)})
        return serialize_doc(doc)
