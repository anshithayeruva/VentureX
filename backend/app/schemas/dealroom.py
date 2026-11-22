from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field


class MessageAttachment(BaseModel):
    name: str
    url: str
    type: str = "document"  # pitch_deck, financial_model, cap_table, memo, other
    size_kb: Optional[int] = None


class MessageCreateInput(BaseModel):
    sender_id: str
    sender_role: str = Field(..., description="FOUNDER or INVESTOR")
    sender_name: str
    content: str
    attachments: Optional[List[MessageAttachment]] = None


class DealMessage(BaseModel):
    id: str
    room_id: str
    sender_id: str
    sender_role: str  # FOUNDER, INVESTOR, or SYSTEM
    sender_name: str
    content: str
    attachments: List[MessageAttachment] = []
    sequence: int
    integrity_hash: str
    created_at: datetime
    is_read: bool = False


class StageUpdateInput(BaseModel):
    stage: str
    note: Optional[str] = None
    sender_id: str
    sender_role: str
    sender_name: str


class NDASignInput(BaseModel):
    signer_id: str
    signer_role: str
    signer_name: str


class DocumentShareInput(BaseModel):
    name: str
    url: str
    type: str = "document"
    size_kb: Optional[int] = None
    sender_id: str
    sender_role: str
    sender_name: str


class DealRoom(BaseModel):
    id: str
    interest_id: Optional[str] = None
    project_id: Union[int, str]
    project_title: str
    project_industry: Optional[str] = None
    founder_id: str
    founder_name: str
    founder_email: str
    founder_company: Optional[str] = None
    investor_id: str
    investor_name: str
    investor_firm: Optional[str] = None
    investor_email: Optional[str] = None
    stage: str = "INTRO_ACCEPTED"  # INTRO_ACCEPTED, DUE_DILIGENCE, TERM_SHEET, PARTNER_MEETING, CLOSED, PASSED
    nda_signed: bool = False
    nda_signed_at: Optional[datetime] = None
    nda_signer_name: Optional[str] = None
    shared_documents: List[MessageAttachment] = []
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_sender: Optional[str] = None
    messages_count: int = 0
    audit_trail_hash: str = ""
    is_secure_recording_active: bool = True
    # Whether the founder may post messages (the investor can turn this off in Settings).
    founder_messaging_open: bool = True


class DealRoomCreateInput(BaseModel):
    interest_id: Optional[str] = None
    project_id: Union[int, str]
    project_title: str
    founder_id: str
    founder_name: str
    founder_email: str
    investor_id: str
    investor_name: str
    investor_firm: Optional[str] = None
    investor_email: Optional[str] = None
    initial_message: Optional[str] = None


class DealRoomAuditLog(BaseModel):
    id: str
    room_id: str
    event_type: str  # ROOM_CREATED, MESSAGE_RECORDED, DOCUMENT_SHARED, STAGE_ADVANCED, NDA_EXECUTED, TRANSCRIPT_EXPORTED
    actor_id: str
    actor_role: str
    actor_name: str
    details: Dict[str, Any]
    tamper_hash: str
    timestamp: datetime
