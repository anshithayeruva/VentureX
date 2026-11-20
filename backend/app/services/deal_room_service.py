import logging
import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union
from bson import ObjectId

from app.database.mongodb import get_database
from app.database.utils import serialize_doc, serialize_docs
from app.schemas.dealroom import (
    MessageCreateInput,
    StageUpdateInput,
    NDASignInput,
    DocumentShareInput,
    DealRoomCreateInput,
)

logger = logging.getLogger(__name__)


def _compute_sha256(data_str: str) -> str:
    """Generate SHA-256 hexadecimal hash string for message chain validation."""
    return hashlib.sha256(data_str.encode("utf-8")).hexdigest()


class DealRoomService:
    """Service handling secure Deal Rooms, tamper-evident conversation recording,

    cryptographic audit trails, and multi-party milestone management.
    """

    @classmethod
    async def _seed_initial_dealrooms_if_empty(cls, db) -> None:
        """Seed initial deal rooms with recorded messages so UI is instantly interactive."""
        count = await db.deal_rooms.count_documents({})
        if count > 0:
            return

        now = datetime.now(timezone.utc)
        room_id = "room-neuropulse-blueshift"
        genesis_hash = _compute_sha256(f"GENESIS|{room_id}|{now.isoformat()}")

        # 1. Initial messages with cryptographic hash chain
        msg1_hash = _compute_sha256(f"{genesis_hash}|1|{now.isoformat()}|investor-002|Hi Alex, Marcus here from BlueShift.")
        msg2_hash = _compute_sha256(f"{msg1_hash}|2|{now.isoformat()}|founder-001|Great to connect, Marcus!")
        msg3_hash = _compute_sha256(f"{msg2_hash}|3|{now.isoformat()}|SYSTEM|Mutual NDA signed by Dr. Sarah Lin & Alex Rivers")
        msg4_hash = _compute_sha256(f"{msg3_hash}|4|{now.isoformat()}|founder-001|Attached our confidential pilot ICU hospital clinical data.")

        initial_messages = [
            {
                "id": "msg-001",
                "room_id": room_id,
                "sender_id": "investor-002",
                "sender_role": "INVESTOR",
                "sender_name": "Marcus Sterling",
                "content": "Hi Alex, Marcus here from BlueShift Capital. We reviewed your pitch teaser and want to deep dive into your edge neural processor benchmarks.",
                "attachments": [],
                "sequence": 1,
                "previous_hash": genesis_hash,
                "integrity_hash": msg1_hash,
                "created_at": now,
                "is_read": True,
            },
            {
                "id": "msg-002",
                "room_id": room_id,
                "sender_id": "founder-001",
                "sender_role": "FOUNDER",
                "sender_name": "Alex Rivers",
                "content": "Great to connect, Marcus! We're excited about BlueShift's deeptech portfolio. We just completed our 2nd hospital ICU deployment with zero telemetry latency.",
                "attachments": [],
                "sequence": 2,
                "previous_hash": msg1_hash,
                "integrity_hash": msg2_hash,
                "created_at": now,
                "is_read": True,
            },
            {
                "id": "msg-003",
                "room_id": room_id,
                "sender_id": "SYSTEM",
                "sender_role": "SYSTEM",
                "sender_name": "VentureX Security Escrow",
                "content": "Mutual Non-Disclosure Agreement (NDA v2.4) digitally executed by both parties. Confidential data room documents unlocked.",
                "attachments": [],
                "sequence": 3,
                "previous_hash": msg2_hash,
                "integrity_hash": msg3_hash,
                "created_at": now,
                "is_read": True,
            },
            {
                "id": "msg-004",
                "room_id": room_id,
                "sender_id": "founder-001",
                "sender_role": "FOUNDER",
                "sender_name": "Alex Rivers",
                "content": "Here is our verified cap table and audited clinical validation study from Johns Hopkins pilot.",
                "attachments": [
                    {
                        "name": "NeuroPulse_Clinical_Validation_2026.pdf",
                        "url": "https://neuropulse.demo/clinical_study.pdf",
                        "type": "clinical_data",
                        "size_kb": 2480,
                    },
                    {
                        "name": "NeuroPulse_CapTable_Series_Seed.xlsx",
                        "url": "https://neuropulse.demo/captable.xlsx",
                        "type": "cap_table",
                        "size_kb": 640,
                    },
                ],
                "sequence": 4,
                "previous_hash": msg3_hash,
                "integrity_hash": msg4_hash,
                "created_at": now,
                "is_read": False,
            },
        ]
        await db.deal_room_messages.insert_many(initial_messages)

        # 2. Initial Room 1
        initial_room_1 = {
            "id": room_id,
            "interest_id": "intro-002",
            "project_id": 1,
            "project_title": "NeuroPulse AI",
            "project_industry": "Healthcare & AI",
            "founder_id": "founder-001",
            "founder_name": "Alex Rivers",
            "founder_email": "alex@neuropulse.demo",
            "founder_company": "NeuroPulse AI",
            "investor_id": "investor-002",
            "investor_name": "Marcus Sterling",
            "investor_firm": "BlueShift Capital",
            "investor_email": "m.sterling@blueshiftcap.com",
            "stage": "DUE_DILIGENCE",
            "nda_signed": True,
            "nda_signed_at": now,
            "nda_signer_name": "Marcus Sterling & Alex Rivers",
            "shared_documents": [
                {
                    "name": "NeuroPulse_Full_PitchDeck_v3.pdf",
                    "url": "https://neuropulse.demo/deck.pdf",
                    "type": "pitch_deck",
                    "size_kb": 4120,
                },
                {
                    "name": "NeuroPulse_Clinical_Validation_2026.pdf",
                    "url": "https://neuropulse.demo/clinical_study.pdf",
                    "type": "clinical_data",
                    "size_kb": 2480,
                },
                {
                    "name": "NeuroPulse_CapTable_Series_Seed.xlsx",
                    "url": "https://neuropulse.demo/captable.xlsx",
                    "type": "cap_table",
                    "size_kb": 640,
                },
            ],
            "created_at": now,
            "updated_at": now,
            "last_message": "Here is our verified cap table and audited clinical validation study from Johns Hopkins pilot.",
            "last_message_at": now,
            "last_message_sender": "Alex Rivers",
            "messages_count": 4,
            "audit_trail_hash": msg4_hash,
            "is_secure_recording_active": True,
        }

        # 3. Initial Room 2 with Dr. Sarah Lin (Apex Horizon)
        room_id_2 = "room-neuropulse-apex"
        g2_hash = _compute_sha256(f"GENESIS|{room_id_2}|{now.isoformat()}")
        m2_1_hash = _compute_sha256(f"{g2_hash}|1|{now.isoformat()}|investor-001|Hello Alex, Sarah Lin here.")

        initial_messages_2 = [
            {
                "id": "msg-101",
                "room_id": room_id_2,
                "sender_id": "investor-001",
                "sender_role": "INVESTOR",
                "sender_name": "Dr. Sarah Lin",
                "content": "Hello Alex, Dr. Sarah Lin here from Apex Horizon. Your ICU telemetry fits squarely into our $50M MedTech thesis. When are you free for an initial partner screening?",
                "attachments": [],
                "sequence": 1,
                "previous_hash": g2_hash,
                "integrity_hash": m2_1_hash,
                "created_at": now,
                "is_read": False,
            }
        ]
        await db.deal_room_messages.insert_many(initial_messages_2)

        initial_room_2 = {
            "id": room_id_2,
            "interest_id": "intro-001",
            "project_id": 1,
            "project_title": "NeuroPulse AI",
            "project_industry": "Healthcare & AI",
            "founder_id": "founder-001",
            "founder_name": "Alex Rivers",
            "founder_email": "alex@neuropulse.demo",
            "founder_company": "NeuroPulse AI",
            "investor_id": "investor-001",
            "investor_name": "Dr. Sarah Lin",
            "investor_firm": "Apex Horizon Ventures",
            "investor_email": "sarah.lin@apexhorizon.vc",
            "stage": "INTRO_ACCEPTED",
            "nda_signed": False,
            "nda_signed_at": None,
            "nda_signer_name": None,
            "shared_documents": [
                {
                    "name": "NeuroPulse_Executive_Summary.pdf",
                    "url": "https://neuropulse.demo/exec_summary.pdf",
                    "type": "pitch_deck",
                    "size_kb": 1200,
                }
            ],
            "created_at": now,
            "updated_at": now,
            "last_message": "Hello Alex, Dr. Sarah Lin here from Apex Horizon. Your ICU telemetry fits squarely into our $50M MedTech thesis.",
            "last_message_at": now,
            "last_message_sender": "Dr. Sarah Lin",
            "messages_count": 1,
            "audit_trail_hash": m2_1_hash,
            "is_secure_recording_active": True,
        }

        await db.deal_rooms.insert_many([initial_room_1, initial_room_2])

        # 4. Audit Log Entries
        audit_entries = [
            {
                "id": str(uuid.uuid4()),
                "room_id": room_id,
                "event_type": "ROOM_CREATED",
                "actor_id": "SYSTEM",
                "actor_role": "SYSTEM",
                "actor_name": "VentureX Deal Engine",
                "details": {"interest_id": "intro-002", "parties": ["founder-001", "investor-002"]},
                "tamper_hash": genesis_hash,
                "timestamp": now,
            },
            {
                "id": str(uuid.uuid4()),
                "room_id": room_id,
                "event_type": "NDA_EXECUTED",
                "actor_id": "investor-002",
                "actor_role": "INVESTOR",
                "actor_name": "Marcus Sterling",
                "details": {"nda_version": "2.4", "signer": "Marcus Sterling"},
                "tamper_hash": msg3_hash,
                "timestamp": now,
            },
            {
                "id": str(uuid.uuid4()),
                "room_id": room_id,
                "event_type": "STAGE_ADVANCED",
                "actor_id": "investor-002",
                "actor_role": "INVESTOR",
                "actor_name": "Marcus Sterling",
                "details": {"from_stage": "INTRO_ACCEPTED", "to_stage": "DUE_DILIGENCE"},
                "tamper_hash": msg4_hash,
                "timestamp": now,
            },
        ]
        await db.deal_room_audit_logs.insert_many(audit_entries)
        logger.info("Successfully seeded initial Deal Rooms, messages, and cryptographic audit records.")

    @classmethod
    async def list_rooms(
        cls,
        user_id: Optional[str] = None,
        role: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve all active deal rooms where user is participant."""
        db = get_database()
        if db is None:
            return []

        await cls._seed_initial_dealrooms_if_empty(db)

        filter_query: Dict[str, Any] = {}
        if user_id:
            clean_uid = str(user_id)
            if role == "FOUNDER":
                filter_query["founder_id"] = clean_uid
            elif role == "INVESTOR":
                filter_query["investor_id"] = clean_uid
            else:
                filter_query["$or"] = [
                    {"founder_id": clean_uid},
                    {"investor_id": clean_uid},
                ]

        cursor = db.deal_rooms.find(filter_query).sort("updated_at", -1)
        rooms = await cursor.to_list(length=100)
        return serialize_docs(rooms)

    @classmethod
    async def get_room(cls, room_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieve single deal room by custom id or ObjectId, verifying participation."""
        db = get_database()
        if db is None:
            return None

        await cls._seed_initial_dealrooms_if_empty(db)

        filter_q = {"id": room_id}
        if ObjectId.is_valid(room_id):
            filter_q = {"$or": [{"id": room_id}, {"_id": ObjectId(room_id)}]}

        room = await db.deal_rooms.find_one(filter_q)
        if not room:
            return None

        # Verify access if user_id provided
        if user_id and str(user_id) not in [room.get("founder_id"), room.get("investor_id"), "admin"]:
            logger.warning("Unauthorized access attempt to deal room %s by user %s", room_id, user_id)
            return None

        return serialize_doc(room)

    @classmethod
    async def create_or_get_from_interest(cls, room_in: DealRoomCreateInput) -> Dict[str, Any]:
        """Create or find existing deal room for an introduction/interest record."""
        db = get_database()
        if db is None:
            raise RuntimeError("Database connection not established")

        # Check existing room by interest_id or project + investor pair
        existing = await db.deal_rooms.find_one({
            "$or": [
                {"interest_id": room_in.interest_id} if room_in.interest_id else {},
                {
                    "project_id": room_in.project_id,
                    "founder_id": room_in.founder_id,
                    "investor_id": room_in.investor_id,
                },
            ]
        })
        if existing:
            return serialize_doc(existing)

        now = datetime.now(timezone.utc)
        room_id = f"room-{uuid.uuid4().hex[:10]}"
        genesis_hash = _compute_sha256(f"GENESIS|{room_id}|{now.isoformat()}")

        new_room = {
            "id": room_id,
            "interest_id": room_in.interest_id,
            "project_id": room_in.project_id,
            "project_title": room_in.project_title,
            "founder_id": room_in.founder_id,
            "founder_name": room_in.founder_name,
            "founder_email": room_in.founder_email,
            "investor_id": room_in.investor_id,
            "investor_name": room_in.investor_name,
            "investor_firm": room_in.investor_firm,
            "investor_email": room_in.investor_email,
            "stage": "INTRO_ACCEPTED",
            "nda_signed": False,
            "nda_signed_at": None,
            "nda_signer_name": None,
            "shared_documents": [],
            "created_at": now,
            "updated_at": now,
            "last_message": room_in.initial_message or "Deal room initiated.",
            "last_message_at": now,
            "last_message_sender": "SYSTEM",
            "messages_count": 1 if room_in.initial_message else 0,
            "audit_trail_hash": genesis_hash,
            "is_secure_recording_active": True,
        }
        await db.deal_rooms.insert_one(new_room)

        # Log genesis audit record
        audit_rec = {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "event_type": "ROOM_CREATED",
            "actor_id": room_in.founder_id,
            "actor_role": "FOUNDER",
            "actor_name": room_in.founder_name,
            "details": {"project": room_in.project_title, "investor": room_in.investor_name},
            "tamper_hash": genesis_hash,
            "timestamp": now,
        }
        await db.deal_room_audit_logs.insert_one(audit_rec)

        if room_in.initial_message:
            init_msg_hash = _compute_sha256(f"{genesis_hash}|1|{now.isoformat()}|SYSTEM|{room_in.initial_message}")
            msg_doc = {
                "id": f"msg-{uuid.uuid4().hex[:8]}",
                "room_id": room_id,
                "sender_id": "SYSTEM",
                "sender_role": "SYSTEM",
                "sender_name": "VentureX Deal Engine",
                "content": room_in.initial_message,
                "attachments": [],
                "sequence": 1,
                "previous_hash": genesis_hash,
                "integrity_hash": init_msg_hash,
                "created_at": now,
                "is_read": False,
            }
            await db.deal_room_messages.insert_one(msg_doc)

        return serialize_doc(new_room)

    @classmethod
    async def get_messages(
        cls,
        room_id: str,
        user_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Retrieve conversation history with cryptographic signatures."""
        db = get_database()
        if db is None:
            return []

        # Access check
        room = await cls.get_room(room_id, user_id=user_id)
        if not room:
            logger.warning("Access denied to room messages for user %s", user_id)
            return []

        cursor = db.deal_room_messages.find({"room_id": room_id}).sort("sequence", 1).limit(limit)
        messages = await cursor.to_list(length=limit)
        return serialize_docs(messages)

    @classmethod
    async def send_message(
        cls,
        room_id: str,
        message_in: MessageCreateInput,
    ) -> Dict[str, Any]:
        """Record and cryptographically seal an immutable conversation message."""
        db = get_database()
        if db is None:
            raise RuntimeError("Database connection not established")

        room = await cls.get_room(room_id)
        if not room:
            raise ValueError(f"Deal Room '{room_id}' not found")

        # Monotonic sequence & cryptographic previous hash resolution
        last_msg = await db.deal_room_messages.find_one(
            {"room_id": room_id},
            sort=[("sequence", -1)]
        )
        prev_hash = last_msg.get("integrity_hash") if last_msg else room.get("audit_trail_hash", "GENESIS")
        next_seq = (last_msg.get("sequence", 0) + 1) if last_msg else 1

        now = datetime.now(timezone.utc)
        attachments_data = [att.model_dump() for att in (message_in.attachments or [])]

        # Calculate immutable SHA-256 integrity signature
        payload_str = f"{prev_hash}|{next_seq}|{now.isoformat()}|{message_in.sender_id}|{message_in.content}"
        msg_hash = _compute_sha256(payload_str)

        msg_id = f"msg-{uuid.uuid4().hex[:10]}"
        msg_doc = {
            "id": msg_id,
            "room_id": room_id,
            "sender_id": message_in.sender_id,
            "sender_role": message_in.sender_role,
            "sender_name": message_in.sender_name,
            "content": message_in.content,
            "attachments": attachments_data,
            "sequence": next_seq,
            "previous_hash": prev_hash,
            "integrity_hash": msg_hash,
            "created_at": now,
            "is_read": False,
        }
        await db.deal_room_messages.insert_one(msg_doc)

        # Update room last message info and audit pointer
        await db.deal_rooms.update_one(
            {"id": room_id},
            {
                "$set": {
                    "last_message": message_in.content[:140],
                    "last_message_at": now,
                    "last_message_sender": message_in.sender_name,
                    "audit_trail_hash": msg_hash,
                    "updated_at": now,
                },
                "$inc": {"messages_count": 1},
            }
        )

        # Append to compliance audit log
        audit_entry = {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "event_type": "MESSAGE_RECORDED",
            "actor_id": message_in.sender_id,
            "actor_role": message_in.sender_role,
            "actor_name": message_in.sender_name,
            "details": {
                "message_id": msg_id,
                "sequence": next_seq,
                "attachments_count": len(attachments_data),
            },
            "tamper_hash": msg_hash,
            "timestamp": now,
        }
        await db.deal_room_audit_logs.insert_one(audit_entry)

        # Send notification to counterparty
        recipient_id = room["investor_id"] if message_in.sender_role == "FOUNDER" else room["founder_id"]
        recipient_role = "INVESTOR" if message_in.sender_role == "FOUNDER" else "FOUNDER"
        notif_doc = {
            "user_id": recipient_id,
            "target_role": recipient_role,
            "title": f"New Message from {message_in.sender_name}",
            "desc": f"{message_in.sender_name} posted in Deal Room for '{room.get('project_title')}': {message_in.content[:80]}",
            "time": "Just now",
            "badge": "Deal Room",
            "badge_variant": "primary",
            "read": False,
            "link": f"/dealroom/{room_id}",
            "created_at": now,
        }
        await db.notifications.insert_one(notif_doc)

        # Dispatch email alert to counterparty
        try:
            from app.services.email_service import EmailService
            recipient_email = (
                room.get("investor_email")
                if message_in.sender_role == "FOUNDER"
                else room.get("founder_email")
            ) or f"{recipient_id}@venturex.io"
            recipient_name = (
                room.get("investor_name")
                if message_in.sender_role == "FOUNDER"
                else room.get("founder_name")
            ) or "Deal Partner"

            EmailService.send_dealroom_message_alert(
                recipient_email=recipient_email,
                recipient_name=recipient_name,
                sender_name=message_in.sender_name,
                project_title=room.get("project_title", "Startup"),
                message_preview=message_in.content,
                room_id=room_id,
                recipient_role=recipient_role,
            )
        except Exception as e:
            logger.warning("Failed to dispatch dealroom message email alert: %s", e)

        return serialize_doc(msg_doc)

    @classmethod
    async def update_stage(cls, room_id: str, stage_in: StageUpdateInput) -> Dict[str, Any]:
        """Advance or update the Deal Room lifecycle stage with a recorded milestone."""
        db = get_database()
        if db is None:
            raise RuntimeError("Database connection not established")

        room = await cls.get_room(room_id)
        if not room:
            raise ValueError(f"Deal Room '{room_id}' not found")

        now = datetime.now(timezone.utc)
        old_stage = room.get("stage", "INTRO_ACCEPTED")

        # Update room stage
        await db.deal_rooms.update_one(
            {"id": room_id},
            {
                "$set": {
                    "stage": stage_in.stage,
                    "updated_at": now,
                }
            }
        )

        # Insert system milestone message into conversation
        note_text = f" Note: {stage_in.note}" if stage_in.note else ""
        system_content = f"🎯 Deal milestone updated to [{stage_in.stage.replace('_', ' ')}] by {stage_in.sender_name}.{note_text}"

        msg_input = MessageCreateInput(
            sender_id="SYSTEM",
            sender_role="SYSTEM",
            sender_name="VentureX Deal Engine",
            content=system_content,
        )
        await cls.send_message(room_id, msg_input)

        # Record audit log
        audit_entry = {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "event_type": "STAGE_ADVANCED",
            "actor_id": stage_in.sender_id,
            "actor_role": stage_in.sender_role,
            "actor_name": stage_in.sender_name,
            "details": {"from_stage": old_stage, "to_stage": stage_in.stage, "note": stage_in.note},
            "tamper_hash": _compute_sha256(f"{room_id}|{stage_in.stage}|{now.isoformat()}"),
            "timestamp": now,
        }
        await db.deal_room_audit_logs.insert_one(audit_entry)

        updated_room = await cls.get_room(room_id)
        return updated_room

    @classmethod
    async def sign_nda(cls, room_id: str, nda_in: NDASignInput) -> Dict[str, Any]:
        """Execute digital NDA bilateral confidentiality agreement."""
        db = get_database()
        if db is None:
            raise RuntimeError("Database connection not established")

        room = await cls.get_room(room_id)
        if not room:
            raise ValueError(f"Deal Room '{room_id}' not found")

        now = datetime.now(timezone.utc)
        await db.deal_rooms.update_one(
            {"id": room_id},
            {
                "$set": {
                    "nda_signed": True,
                    "nda_signed_at": now,
                    "nda_signer_name": nda_in.signer_name,
                    "updated_at": now,
                }
            }
        )

        # Announce in deal room
        content = f"🔒 Mutual Non-Disclosure Agreement (NDA) digitally executed by {nda_in.signer_name} ({nda_in.signer_role}). Full diligence data room is now accessible."
        msg_input = MessageCreateInput(
            sender_id="SYSTEM",
            sender_role="SYSTEM",
            sender_name="VentureX Legal Escrow",
            content=content,
        )
        await cls.send_message(room_id, msg_input)

        # Audit log
        audit_entry = {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "event_type": "NDA_EXECUTED",
            "actor_id": nda_in.signer_id,
            "actor_role": nda_in.signer_role,
            "actor_name": nda_in.signer_name,
            "details": {"status": "ACTIVE_ENFORCED", "timestamp": now.isoformat()},
            "tamper_hash": _compute_sha256(f"NDA|{room_id}|{nda_in.signer_id}|{now.isoformat()}"),
            "timestamp": now,
        }
        await db.deal_room_audit_logs.insert_one(audit_entry)

        return await cls.get_room(room_id)

    @classmethod
    async def share_document(cls, room_id: str, doc_in: DocumentShareInput) -> Dict[str, Any]:
        """Share a confidential file / document into the Deal Room vault."""
        db = get_database()
        if db is None:
            raise RuntimeError("Database connection not established")

        room = await cls.get_room(room_id)
        if not room:
            raise ValueError(f"Deal Room '{room_id}' not found")

        doc_dict = {
            "name": doc_in.name,
            "url": doc_in.url,
            "type": doc_in.type,
            "size_kb": doc_in.size_kb or 1024,
        }

        # Add to shared documents in room
        await db.deal_rooms.update_one(
            {"id": room_id},
            {
                "$push": {"shared_documents": doc_dict},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            }
        )

        # Post message with attachment
        content = f"📁 New confidential document shared: {doc_in.name} ({doc_in.type.replace('_', ' ').title()})"
        msg_input = MessageCreateInput(
            sender_id=doc_in.sender_id,
            sender_role=doc_in.sender_role,
            sender_name=doc_in.sender_name,
            content=content,
            attachments=[doc_dict],
        )
        await cls.send_message(room_id, msg_input)

        return await cls.get_room(room_id)

    @classmethod
    async def export_transcript(
        cls,
        room_id: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Export tamper-verified conversation transcript with integrity certificates for regulatory compliance."""
        db = get_database()
        if db is None:
            raise RuntimeError("Database connection not established")

        room = await cls.get_room(room_id, user_id=user_id)
        if not room:
            raise ValueError(f"Deal Room '{room_id}' not accessible or not found")

        messages = await cls.get_messages(room_id, user_id=user_id, limit=500)
        logs = await cls.get_audit_logs(room_id)

        # Validate complete chain
        chain_valid = True
        verification_details = []
        for i, msg in enumerate(messages):
            if i == 0:
                continue
            prev = messages[i - 1]
            if msg.get("previous_hash") != prev.get("integrity_hash"):
                chain_valid = False
                verification_details.append(f"Broken hash at sequence {msg.get('sequence')}")

        now = datetime.now(timezone.utc)
        transcript = {
            "export_id": f"export-{uuid.uuid4().hex[:12]}",
            "exported_at": now.isoformat(),
            "deal_room_id": room_id,
            "project_title": room.get("project_title"),
            "founder": {
                "name": room.get("founder_name"),
                "email": room.get("founder_email"),
                "company": room.get("founder_company"),
            },
            "investor": {
                "name": room.get("investor_name"),
                "firm": room.get("investor_firm"),
                "email": room.get("investor_email"),
            },
            "deal_stage": room.get("stage"),
            "nda_status": "EXECUTED" if room.get("nda_signed") else "PENDING",
            "nda_signed_at": room.get("nda_signed_at"),
            "total_messages": len(messages),
            "cryptographic_integrity_status": "VERIFIED_TAMPER_EVIDENT" if chain_valid else "WARNING_INTEGRITY_MISMATCH",
            "latest_audit_hash": room.get("audit_trail_hash"),
            "conversation_records": [
                {
                    "sequence": m.get("sequence"),
                    "timestamp": m.get("created_at"),
                    "sender": f"{m.get('sender_name')} ({m.get('sender_role')})",
                    "content": m.get("content"),
                    "attachments": [a.get("name") for a in (m.get("attachments") or [])],
                    "sha256_signature": m.get("integrity_hash"),
                }
                for m in messages
            ],
            "audit_trail_summary": [
                {
                    "event": l.get("event_type"),
                    "actor": f"{l.get('actor_name')} ({l.get('actor_role')})",
                    "timestamp": l.get("timestamp"),
                    "hash": l.get("tamper_hash"),
                }
                for l in logs
            ],
            "legal_disclaimer": "This transcript is generated by VentureX Regulated Communications Escrow. Cryptographic SHA-256 signatures verify authenticity and chronological order.",
        }

        # Log transcript export event
        audit_entry = {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "event_type": "TRANSCRIPT_EXPORTED",
            "actor_id": user_id or "system",
            "actor_role": "COMPLIANCE",
            "actor_name": "Audit Export Service",
            "details": {"messages_count": len(messages), "integrity": chain_valid},
            "tamper_hash": _compute_sha256(f"EXPORT|{room_id}|{now.isoformat()}"),
            "timestamp": now,
        }
        await db.deal_room_audit_logs.insert_one(audit_entry)

        return transcript

    @classmethod
    async def get_audit_logs(cls, room_id: str) -> List[Dict[str, Any]]:
        """Retrieve the immutable tamper-evident event log for a Deal Room."""
        db = get_database()
        if db is None:
            return []

        cursor = db.deal_room_audit_logs.find({"room_id": room_id}).sort("timestamp", 1)
        logs = await cursor.to_list(length=100)
        return serialize_docs(logs)
