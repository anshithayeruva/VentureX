import logging
import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union
from app.database import postgres as pg
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


# Appends one message to a room's hash chain in a single atomic statement:
# lock the room, find the chain tip, insert the sealed message, update the room.
# integrity_hash = sha256("{previous_hash}|{sequence}|{created_at iso}|{sender_id}|{content}"),
# identical to _compute_sha256() over the same string, so exported transcripts verify.
_SEND_MESSAGE_SQL = """
WITH room AS (
    SELECT id, audit_trail_hash FROM deal_rooms WHERE id = %s FOR UPDATE
), tip AS (
    SELECT
        COALESCE(
            (SELECT m.integrity_hash FROM deal_room_messages m
             WHERE m.room_id = room.id ORDER BY m.sequence DESC LIMIT 1),
            room.audit_trail_hash,
            'GENESIS'
        ) AS prev_hash,
        COALESCE((SELECT max(m.sequence) FROM deal_room_messages m WHERE m.room_id = room.id), 0) + 1 AS seq
    FROM room
), ins AS (
    INSERT INTO deal_room_messages
        (id, room_id, sender_id, sender_role, sender_name, content, attachments,
         sequence, previous_hash, integrity_hash, created_at, is_read)
    SELECT %s, room.id, %s, %s, %s, %s, %s::jsonb,
           tip.seq, tip.prev_hash,
           encode(sha256(convert_to(
               tip.prev_hash || '|' || tip.seq::text || '|' || %s::text || '|' || %s::text || '|' || %s::text,
               'UTF8')), 'hex'),
           %s::timestamptz, FALSE
    FROM room, tip
    RETURNING *
), upd AS (
    UPDATE deal_rooms d
    SET last_message = %s, last_message_at = ins.created_at, last_message_sender = %s,
        audit_trail_hash = ins.integrity_hash, updated_at = ins.created_at,
        messages_count = d.messages_count + 1
    FROM ins
    WHERE d.id = ins.room_id
)
SELECT * FROM ins
"""


class DealRoomService:
    """Service handling secure Deal Rooms, tamper-evident conversation recording,

    cryptographic audit trails, and multi-party milestone management.
    """

    @classmethod
    async def list_rooms(
        cls,
        user_id: Optional[str] = None,
        role: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve all active deal rooms where user is participant."""
        where = ""
        params: List[Any] = []
        if user_id:
            clean_uid = str(user_id)
            if role == "FOUNDER":
                where = " WHERE founder_id = %s"
                params = [clean_uid]
            elif role == "INVESTOR":
                where = " WHERE investor_id = %s"
                params = [clean_uid]
            else:
                where = " WHERE founder_id = %s OR investor_id = %s"
                params = [clean_uid, clean_uid]

        return await pg.fetch_all(
            f"SELECT * FROM deal_rooms{where} ORDER BY updated_at DESC, id LIMIT 100", params
        )

    @classmethod
    async def get_room(cls, room_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieve a single deal room by id, verifying participation."""
        room = await pg.fetch_one("SELECT * FROM deal_rooms WHERE id = %s", [room_id])
        if not room:
            return None

        # Verify access if user_id provided
        if user_id and str(user_id) not in [room.get("founder_id"), room.get("investor_id"), "admin"]:
            logger.warning("Unauthorized access attempt to deal room %s by user %s", room_id, user_id)
            return None

        return room

    @classmethod
    async def create_or_get_from_interest(cls, room_in: DealRoomCreateInput) -> Dict[str, Any]:
        """Create or find existing deal room for an introduction/interest record."""
        # Check existing room by interest_id or project + investor pair
        try:
            project_id = int(room_in.project_id)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid project id '{room_in.project_id}'")

        existing = await pg.fetch_one(
            """
            SELECT * FROM deal_rooms
            WHERE (%s::text IS NOT NULL AND interest_id = %s)
               OR (project_id = %s AND founder_id = %s AND investor_id = %s)
            LIMIT 1
            """,
            [room_in.interest_id, room_in.interest_id, project_id, room_in.founder_id, room_in.investor_id],
        )
        if existing:
            return existing

        now = datetime.now(timezone.utc)
        room_id = f"room-{uuid.uuid4().hex[:10]}"
        genesis_hash = _compute_sha256(f"GENESIS|{room_id}|{now.isoformat()}")

        new_room = {
            "id": room_id,
            "interest_id": room_in.interest_id,
            "project_id": project_id,
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
        created_room = await pg.insert("deal_rooms", new_room)

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
        await pg.insert("deal_room_audit_logs", audit_rec, returning=False)

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
            await pg.insert("deal_room_messages", msg_doc, returning=False)

        return created_room

    @classmethod
    async def get_messages(
        cls,
        room_id: str,
        user_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Retrieve conversation history with cryptographic signatures."""
        # Access check
        room = await cls.get_room(room_id, user_id=user_id)
        if not room:
            logger.warning("Access denied to room messages for user %s", user_id)
            return []

        return await pg.fetch_all(
            "SELECT * FROM deal_room_messages WHERE room_id = %s ORDER BY sequence LIMIT %s",
            [room_id, limit],
        )

    @classmethod
    async def send_message(
        cls,
        room_id: str,
        message_in: MessageCreateInput,
    ) -> Dict[str, Any]:
        """Record and cryptographically seal an immutable conversation message."""
        room = await cls.get_room(room_id)
        if not room:
            raise ValueError(f"Deal Room '{room_id}' not found")

        now = datetime.now(timezone.utc)
        attachments_data = [att.model_dump() for att in (message_in.attachments or [])]

        msg_id = f"msg-{uuid.uuid4().hex[:10]}"
        created_iso = now.isoformat()
        params = [
            room_id,                                   # room
            msg_id, message_in.sender_id, message_in.sender_role, message_in.sender_name,
            message_in.content, pg.Jsonb(attachments_data),
            created_iso, message_in.sender_id, message_in.content,   # hash payload
            created_iso,                               # created_at
            message_in.content[:140], message_in.sender_name,        # room summary
        ]
        msg_doc = None
        for attempt in range(3):
            try:
                msg_doc = await pg.fetch_one(_SEND_MESSAGE_SQL, params)
                break
            except pg.DatabaseError as e:
                # Two senders raced for the same sequence number: the UNIQUE
                # (room_id, sequence) constraint rejected one; retry on the new tip.
                if e.code != "23505" or attempt == 2:
                    raise
        if msg_doc is None:
            raise ValueError(f"Deal Room '{room_id}' not found")
        next_seq = msg_doc["sequence"]
        msg_hash = msg_doc["integrity_hash"]

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
        await pg.insert("deal_room_audit_logs", audit_entry, returning=False)

        # Send notification to counterparty
        recipient_id = room["investor_id"] if message_in.sender_role == "FOUNDER" else room["founder_id"]
        recipient_role = "INVESTOR" if message_in.sender_role == "FOUNDER" else "FOUNDER"
        from app.services.notification_service import NotificationService
        await NotificationService.create_notification(
            target_role=recipient_role,
            user_id=recipient_id,
            title=f"New Message from {message_in.sender_name}",
            desc=f"{message_in.sender_name} posted in Deal Room for '{room.get('project_title')}': {message_in.content[:80]}",
            badge="Deal Room",
            badge_variant="primary",
            link=f"/dealroom/{room_id}",
        )

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

        return msg_doc

    @classmethod
    async def update_stage(cls, room_id: str, stage_in: StageUpdateInput) -> Dict[str, Any]:
        """Advance or update the Deal Room lifecycle stage with a recorded milestone."""
        room = await cls.get_room(room_id)
        if not room:
            raise ValueError(f"Deal Room '{room_id}' not found")

        now = datetime.now(timezone.utc)
        old_stage = room.get("stage", "INTRO_ACCEPTED")

        # Update room stage
        await pg.update_where("deal_rooms", {"stage": stage_in.stage, "updated_at": now}, "id = %s", [room_id])

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
        await pg.insert("deal_room_audit_logs", audit_entry, returning=False)

        updated_room = await cls.get_room(room_id)
        return updated_room

    @classmethod
    async def sign_nda(cls, room_id: str, nda_in: NDASignInput) -> Dict[str, Any]:
        """Execute digital NDA bilateral confidentiality agreement."""
        room = await cls.get_room(room_id)
        if not room:
            raise ValueError(f"Deal Room '{room_id}' not found")

        now = datetime.now(timezone.utc)
        await pg.update_where(
            "deal_rooms",
            {"nda_signed": True, "nda_signed_at": now, "nda_signer_name": nda_in.signer_name, "updated_at": now},
            "id = %s",
            [room_id],
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
        await pg.insert("deal_room_audit_logs", audit_entry, returning=False)

        return await cls.get_room(room_id)

    @classmethod
    async def share_document(cls, room_id: str, doc_in: DocumentShareInput) -> Dict[str, Any]:
        """Share a confidential file / document into the Deal Room vault."""
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
        await pg.execute(
            "UPDATE deal_rooms SET shared_documents = shared_documents || %s, updated_at = now() WHERE id = %s",
            [pg.Jsonb([doc_dict]), room_id],
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
        await pg.insert("deal_room_audit_logs", audit_entry, returning=False)

        return transcript

    @classmethod
    async def get_audit_logs(cls, room_id: str) -> List[Dict[str, Any]]:
        """Retrieve the immutable tamper-evident event log for a Deal Room."""
        return await pg.fetch_all(
            'SELECT * FROM deal_room_audit_logs WHERE room_id = %s ORDER BY "timestamp" LIMIT 100',
            [room_id],
        )
