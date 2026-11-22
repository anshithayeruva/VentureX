import logging
import json
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, File, Form, HTTPException, status, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, Response

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
from app.core.auth import CurrentUser, require_user, user_from_token
from app.core.rate_limit import rate_limit
from app.services import dealroom_files
from app.services.deal_room_service import DealRoomService, MessagingClosed
from app.utils.pdf_generator import PDFGenerator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dealrooms", tags=["Deal Rooms & Secure Messaging"])


class ConnectionManager:
    """Manages active WebSocket connections per Deal Room for real-time messaging, typing, and presence."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        logger.info("WebSocket client connected to deal room: %s (total: %d)", room_id, len(self.active_connections[room_id]))

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
        logger.info("WebSocket client disconnected from deal room: %s", room_id)

    async def broadcast(self, room_id: str, message: dict, sender_socket: Optional[WebSocket] = None):
        if room_id not in self.active_connections:
            return
        # Messages carry datetimes from Postgres; encode once so send_json can serialize them.
        message = jsonable_encoder(message)
        dead_sockets = []
        for connection in list(self.active_connections[room_id]):
            if sender_socket and connection is sender_socket:
                continue
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning("Failed to send WebSocket message in room %s: %s", room_id, e)
                dead_sockets.append(connection)

        for dead in dead_sockets:
            self.disconnect(room_id, dead)


manager = ConnectionManager()


async def _require_participant(room_id: str, user: CurrentUser) -> dict:
    """Only the room's founder or investor may act in it."""
    room = await DealRoomService.get_room(room_id, user_id=user.id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deal Room '{room_id}' not found or access denied",
        )
    return room


def _as_sender(user: CurrentUser) -> dict:
    """Identity fields come from the verified token, never from the request body."""
    return {"sender_id": user.id, "sender_role": user.role or "FOUNDER", "sender_name": user.name or user.email}


@router.get("", response_model=List[DealRoom])
async def list_deal_rooms(user: CurrentUser = Depends(require_user)):
    """List the deal rooms you are a party to."""
    return await DealRoomService.list_rooms(user_id=user.id, role=user.role)


@router.post("", response_model=DealRoom, status_code=status.HTTP_201_CREATED)
async def create_deal_room(room_in: DealRoomCreateInput, user: CurrentUser = Depends(require_user)):
    """Initiate a secure Deal Room between a founder and matched investor."""
    if user.id not in (room_in.founder_id, room_in.investor_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You must be a party to the deal room")
    try:
        room = await DealRoomService.create_or_get_from_interest(room_in)
        return room
    except Exception as e:
        logger.error("Failed to create deal room: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not initialize Deal Room. Please try again.",
        )


@router.get("/{room_id}", response_model=DealRoom)
async def get_deal_room(room_id: str, user: CurrentUser = Depends(require_user)):
    """Retrieve metadata, NDA state, and data room parameters for one of your deal rooms."""
    room = await _require_participant(room_id, user)
    return {**room, "founder_messaging_open": await DealRoomService.founder_messaging_open(room["investor_id"])}


@router.get("/{room_id}/messages", response_model=List[DealMessage])
async def get_messages(
    room_id: str,
    limit: int = Query(100, ge=1, le=500),
    user: CurrentUser = Depends(require_user),
):
    """Retrieve full chronological conversation records with SHA-256 integrity signatures."""
    await _require_participant(room_id, user)
    return await DealRoomService.get_messages(room_id, user_id=user.id, limit=limit)


@router.post("/{room_id}/messages", response_model=DealMessage, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit("message", 60, 60))])
async def send_message(
    room_id: str,
    message_in: MessageCreateInput,
    user: CurrentUser = Depends(require_user),
):
    """Post and cryptographically record an immutable direct message into the Deal Room."""
    await _require_participant(room_id, user)
    message_in = message_in.model_copy(update=_as_sender(user))
    try:
        msg = await DealRoomService.send_message(room_id, message_in)
        # Real-time WebSocket broadcast to all connected participants in this room
        try:
            await manager.broadcast(room_id, {"type": "message", "data": msg})
        except Exception as ws_err:
            logger.warning("Could not broadcast message to WebSocket: %s", ws_err)
        return msg
    except MessagingClosed as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Failed to post message in deal room %s: %s", room_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record message. Please try again.",
        )


@router.websocket("/ws/{room_id}")
async def dealroom_websocket(websocket: WebSocket, room_id: str, token: Optional[str] = Query(None)):
    """Live channel for messages, typing indicators and presence.

    Browsers cannot set an Authorization header on WebSockets, so the client passes its
    short-lived Neon Auth JWT as ?token=. Only the room's founder and investor may connect,
    and everything they send is attributed to the verified user.
    """
    try:
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in required")
        user = await user_from_token(token)
        room = await DealRoomService.get_room(room_id, user_id=user.id)
    except HTTPException:
        await websocket.close(code=4401)
        return
    if not room:
        await websocket.close(code=4403)
        return

    await manager.connect(room_id, websocket)
    # Broadcast participant presence
    await manager.broadcast(
        room_id,
        {"type": "presence", "event": "joined", "room_id": room_id},
        sender_socket=websocket,
    )
    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                data = json.loads(text_data)
            except Exception:
                continue

            action_type = data.get("type", "message")
            if action_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif action_type == "typing":
                await manager.broadcast(
                    room_id,
                    {
                        "type": "typing",
                        "user_id": user.id,
                        "user_name": user.name or user.email,
                        "is_typing": data.get("is_typing", True),
                    },
                    sender_socket=websocket,
                )
            elif action_type == "message":
                msg_payload = data.get("data")
                if msg_payload:
                    try:
                        input_obj = MessageCreateInput(**{**msg_payload, **_as_sender(user)})
                        saved_msg = await DealRoomService.send_message(room_id, input_obj)
                        # Broadcast to all connections in room
                        await manager.broadcast(room_id, {"type": "message", "data": saved_msg})
                    except Exception as err:
                        logger.error("WebSocket message processing failed: %s", err)
                        await websocket.send_json({"type": "error", "detail": str(err)})
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
        await manager.broadcast(
            room_id,
            {"type": "presence", "event": "left", "room_id": room_id},
        )
    except Exception as e:
        logger.warning("WebSocket error in room %s: %s", room_id, e)
        manager.disconnect(room_id, websocket)


@router.patch("/{room_id}/stage", response_model=DealRoom)
async def update_stage(room_id: str, stage_in: StageUpdateInput, user: CurrentUser = Depends(require_user)):
    """Advance deal pipeline milestone (e.g. Due Diligence, Term Sheet) with audit record."""
    await _require_participant(room_id, user)
    stage_in = stage_in.model_copy(update=_as_sender(user))
    try:
        updated_room = await DealRoomService.update_stage(room_id, stage_in)
        return updated_room
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Request failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Something went wrong. Please try again.")


@router.post("/{room_id}/nda", response_model=DealRoom)
async def sign_nda(room_id: str, nda_in: NDASignInput, user: CurrentUser = Depends(require_user)):
    """Digitally sign bilateral NDA to unlock full diligence documents."""
    await _require_participant(room_id, user)
    sender = _as_sender(user)
    nda_in = nda_in.model_copy(update={
        "signer_id": sender["sender_id"],
        "signer_role": sender["sender_role"],
        "signer_name": sender["sender_name"],
    })
    try:
        updated_room = await DealRoomService.sign_nda(room_id, nda_in)
        return updated_room
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Request failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Something went wrong. Please try again.")


@router.post("/{room_id}/documents", response_model=DealRoom)
async def share_document(room_id: str, doc_in: DocumentShareInput, user: CurrentUser = Depends(require_user)):
    """Upload or share a confidential pitch deck, financial model, or cap table into the Deal Room."""
    await _require_participant(room_id, user)
    # Links only: files are uploaded through POST /{room_id}/files, which stores them privately.
    if not doc_in.url.lower().startswith(("https://", "http://")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Share a link that starts with https://")
    doc_in = doc_in.model_copy(update=_as_sender(user))
    try:
        updated_room = await DealRoomService.share_document(room_id, doc_in)
        return updated_room
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Request failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Something went wrong. Please try again.")


@router.post("/{room_id}/files", response_model=DealRoom,
             dependencies=[Depends(rate_limit("upload", 60, 3600))])
async def upload_room_file(
    room_id: str,
    file: UploadFile = File(...),
    type: str = Form("other"),
    name: Optional[str] = Form(None),
    user: CurrentUser = Depends(require_user),
):
    """Upload a file into the deal room. It is stored privately and only the room's two
    participants can download it (GET /{room_id}/files/{file_id})."""
    await _require_participant(room_id, user)
    try:
        file_id, original, size_kb = await dealroom_files.save(room_id, file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    doc_in = DocumentShareInput(
        name=(name or "").strip() or original,
        url=dealroom_files.file_url(room_id, file_id),
        type=type or "other",
        size_kb=size_kb,
        **_as_sender(user),
    )
    try:
        return await DealRoomService.share_document(room_id, doc_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{room_id}/files/{file_id}")
async def download_room_file(room_id: str, file_id: str, user: CurrentUser = Depends(require_user)):
    """Download a file shared in the deal room (participants only)."""
    await _require_participant(room_id, user)
    found = dealroom_files.locate(room_id, file_id)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    path, filename, content_type = found
    return FileResponse(path, media_type=content_type, filename=filename)


@router.get("/{room_id}/transcript")
async def export_transcript(room_id: str, user: CurrentUser = Depends(require_user)):
    """Export compliant, cryptographically-sealed transcript of the Deal Room dialogue."""
    await _require_participant(room_id, user)
    try:
        transcript = await DealRoomService.export_transcript(room_id, user_id=user.id)
        return transcript
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Request failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Something went wrong. Please try again.")


@router.get("/{room_id}/export-pdf")
async def export_dealroom_pdf(room_id: str, user: CurrentUser = Depends(require_user)):
    """Export verified, tamper-evident cryptographic closing certificate and transcript as PDF."""
    room = await _require_participant(room_id, user)
    try:
        messages = await DealRoomService.get_messages(room_id, user_id=user.id, limit=500)
        audit_logs = await DealRoomService.get_audit_logs(room_id)

        pdf_bytes = PDFGenerator.generate_dealroom_audit_pdf(room, messages, audit_logs)
        proj_slug = (room.get("project_title") or "DealRoom").replace(" ", "_")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="VentureX_Audit_Transcript_{proj_slug}.pdf"'
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to generate deal room audit PDF: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate audit PDF. Please try again.",
        )


@router.get("/{room_id}/audit-logs", response_model=List[DealRoomAuditLog])
async def get_audit_logs(room_id: str, user: CurrentUser = Depends(require_user)):
    """Retrieve immutable audit log of all events and access within the Deal Room."""
    await _require_participant(room_id, user)
    logs = await DealRoomService.get_audit_logs(room_id)
    return logs
