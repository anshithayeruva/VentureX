import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query

from app.schemas.dealroom import (
    DealRoom,
    DealMessage,
    MessageCreateInput,
    StageUpdateInput,
    NDASignInput,
    DocumentShareInput,
    DealRoomCreateInput,
    DealRoomAuditLog,
)
from app.services.deal_room_service import DealRoomService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dealrooms", tags=["Deal Rooms & Secure Messaging"])


@router.get("", response_model=List[DealRoom])
async def list_deal_rooms(
    user_id: Optional[str] = Query(None, description="Filter by user participant ID"),
    role: Optional[str] = Query(None, description="Role of user: FOUNDER or INVESTOR"),
):
    """List all active, confidential Deal Rooms for the participating founder or investor."""
    rooms = await DealRoomService.list_rooms(user_id=user_id, role=role)
    return rooms


@router.post("", response_model=DealRoom, status_code=status.HTTP_201_CREATED)
async def create_deal_room(room_in: DealRoomCreateInput):
    """Initiate a secure Deal Room between a founder and matched investor."""
    try:
        room = await DealRoomService.create_or_get_from_interest(room_in)
        return room
    except Exception as e:
        logger.error("Failed to create deal room: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not initialize Deal Room: {str(e)}",
        )


@router.get("/{room_id}", response_model=DealRoom)
async def get_deal_room(
    room_id: str,
    user_id: Optional[str] = Query(None, description="ID of accessing user for authorization"),
):
    """Retrieve metadata, NDA state, and data room parameters for a specific Deal Room."""
    room = await DealRoomService.get_room(room_id, user_id=user_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deal Room '{room_id}' not found or access denied",
        )
    return room


@router.get("/{room_id}/messages", response_model=List[DealMessage])
async def get_messages(
    room_id: str,
    user_id: Optional[str] = Query(None, description="User participant ID"),
    limit: int = Query(100, ge=1, le=500),
):
    """Retrieve full chronological conversation records with SHA-256 integrity signatures."""
    messages = await DealRoomService.get_messages(room_id, user_id=user_id, limit=limit)
    return messages


@router.post("/{room_id}/messages", response_model=DealMessage, status_code=status.HTTP_201_CREATED)
async def send_message(room_id: str, message_in: MessageCreateInput):
    """Post and cryptographically record an immutable direct message into the Deal Room."""
    try:
        msg = await DealRoomService.send_message(room_id, message_in)
        return msg
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Failed to post message in deal room %s: %s", room_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record message: {str(e)}",
        )


@router.patch("/{room_id}/stage", response_model=DealRoom)
async def update_stage(room_id: str, stage_in: StageUpdateInput):
    """Advance deal pipeline milestone (e.g. Due Diligence, Term Sheet) with audit record."""
    try:
        updated_room = await DealRoomService.update_stage(room_id, stage_in)
        return updated_room
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{room_id}/nda", response_model=DealRoom)
async def sign_nda(room_id: str, nda_in: NDASignInput):
    """Digitally sign bilateral NDA to unlock full diligence documents."""
    try:
        updated_room = await DealRoomService.sign_nda(room_id, nda_in)
        return updated_room
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{room_id}/documents", response_model=DealRoom)
async def share_document(room_id: str, doc_in: DocumentShareInput):
    """Upload or share a confidential pitch deck, financial model, or cap table into the Deal Room."""
    try:
        updated_room = await DealRoomService.share_document(room_id, doc_in)
        return updated_room
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{room_id}/transcript")
async def export_transcript(
    room_id: str,
    user_id: Optional[str] = Query(None, description="User participant requesting transcript"),
):
    """Export compliant, cryptographically-sealed transcript of the Deal Room dialogue."""
    try:
        transcript = await DealRoomService.export_transcript(room_id, user_id=user_id)
        return transcript
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{room_id}/audit-logs", response_model=List[DealRoomAuditLog])
async def get_audit_logs(room_id: str):
    """Retrieve immutable audit log of all events and access within the Deal Room."""
    logs = await DealRoomService.get_audit_logs(room_id)
    return logs
