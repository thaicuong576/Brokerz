from datetime import datetime
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.schema import BrokerWorkspace, Inquiry, InquiryMessage, Notification, Profile, WorkspaceMembership
from src.shared.auth.dependencies import CurrentActor, get_current_actor

router = APIRouter(prefix="/api/v1/inquiry", tags=["Inquiry"])


class MessageCreate(BaseModel):
    content: str
    image_url: Optional[str] = None
    is_ai_generated: bool = False


class ThreadCreate(BaseModel):
    title: str
    is_private: bool = True
    initial_message: str
    image_url: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    content: str
    image_url: Optional[str] = None
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str] = None
    is_ai_generated: bool
    created_at: datetime


class ThreadResponse(BaseModel):
    id: str
    title: str
    status: str
    is_private: bool
    image_url: Optional[str] = None
    created_by: str
    author_name: str
    author_avatar: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int


def _get_effective_broker_id(db: Session, profile: Profile) -> Optional[uuid.UUID]:
    membership = (
        db.query(WorkspaceMembership)
        .filter(
            WorkspaceMembership.profile_id == profile.id,
            WorkspaceMembership.status == "ACTIVE",
        )
        .first()
    )
    if not membership:
        return None

    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.id == membership.workspace_id).first()
    if not workspace:
        return None
    return workspace.owner_profile_id


def _get_thread_for_actor(db: Session, thread_id: uuid.UUID, profile: Profile) -> Inquiry:
    thread = db.query(Inquiry).filter(Inquiry.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread khong ton tai")

    if profile.role == "BROKER":
        if thread.assigned_broker != profile.id:
            raise HTTPException(status_code=403, detail="Ban khong co quyen truy cap thread nay")
        return thread

    broker_id = _get_effective_broker_id(db, profile)
    if not broker_id or thread.assigned_broker != broker_id:
        raise HTTPException(status_code=403, detail="Ban khong co quyen truy cap thread nay")
    if thread.is_private and thread.created_by != profile.id:
        raise HTTPException(status_code=403, detail="Ban khong co quyen truy cap thread rieng tu nay")
    return thread


@router.get("/threads", response_model=List[ThreadResponse])
async def get_threads(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    user_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile khong ton tai")

    query = db.query(Inquiry)
    if profile.role == "BROKER":
        query = query.filter(Inquiry.assigned_broker == user_id)
    else:
        broker_id = _get_effective_broker_id(db, profile)
        if not broker_id:
            return []
        query = query.filter(
            Inquiry.assigned_broker == broker_id,
            ((Inquiry.created_by == user_id) | (Inquiry.is_private == False)),
        )

    threads = query.order_by(Inquiry.updated_at.desc()).all()
    result = []
    for thread in threads:
        author = db.query(Profile).filter(Profile.id == thread.created_by).first()
        message_count = db.query(InquiryMessage).filter(InquiryMessage.inquiry_id == thread.id).count()
        result.append(
            {
                "id": str(thread.id),
                "title": thread.title,
                "status": thread.status,
                "is_private": thread.is_private,
                "image_url": thread.image_url,
                "created_by": str(thread.created_by),
                "author_name": author.full_name if author else "User",
                "author_avatar": author.avatar_url if author else None,
                "created_at": thread.created_at,
                "updated_at": thread.updated_at,
                "message_count": message_count,
            }
        )
    return result


@router.post("/threads", response_model=ThreadResponse)
async def create_thread(data: ThreadCreate, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    user_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile khong ton tai")

    if profile.role == "BROKER":
        assigned_broker = user_id
    else:
        assigned_broker = _get_effective_broker_id(db, profile)
        if not assigned_broker:
            raise HTTPException(status_code=400, detail="Ban can kich hoat SoulKey de ket noi voi Broker truoc")

    new_inquiry = Inquiry(
        id=uuid.uuid4(),
        title=data.title,
        is_private=data.is_private,
        image_url=data.image_url,
        created_by=user_id,
        assigned_broker=assigned_broker,
        status="OPEN",
    )
    db.add(new_inquiry)
    db.flush()

    db.add(
        InquiryMessage(
            id=uuid.uuid4(),
            inquiry_id=new_inquiry.id,
            sender_id=user_id,
            content=data.initial_message,
            image_url=data.image_url,
            is_ai_generated=False,
        )
    )
    db.commit()
    db.refresh(new_inquiry)

    return {
        "id": str(new_inquiry.id),
        "title": new_inquiry.title,
        "status": new_inquiry.status,
        "is_private": new_inquiry.is_private,
        "image_url": new_inquiry.image_url,
        "created_by": str(new_inquiry.created_by),
        "author_name": profile.full_name or "User",
        "author_avatar": profile.avatar_url,
        "created_at": new_inquiry.created_at,
        "updated_at": new_inquiry.updated_at,
        "message_count": 1,
    }


@router.get("/threads/{thread_id}/messages", response_model=List[MessageResponse])
async def get_thread_messages(
    thread_id: str,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile khong ton tai")

    thread_uuid = uuid.UUID(thread_id)
    _get_thread_for_actor(db, thread_uuid, profile)
    messages = (
        db.query(InquiryMessage)
        .filter(InquiryMessage.inquiry_id == thread_uuid)
        .order_by(InquiryMessage.created_at.asc())
        .all()
    )

    result = []
    for message in messages:
        sender = db.query(Profile).filter(Profile.id == message.sender_id).first()
        result.append(
            {
                "id": str(message.id),
                "content": message.content,
                "image_url": message.image_url,
                "sender_id": str(message.sender_id),
                "sender_name": sender.full_name if sender else ("AI Assistant" if message.is_ai_generated else "Unknown"),
                "sender_avatar": sender.avatar_url if sender else None,
                "is_ai_generated": message.is_ai_generated,
                "created_at": message.created_at,
            }
        )
    return result


@router.post("/threads/{thread_id}/messages", response_model=MessageResponse)
async def add_message(
    thread_id: str,
    data: MessageCreate,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    thread_uuid = uuid.UUID(thread_id)
    user_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile khong ton tai")

    thread = _get_thread_for_actor(db, thread_uuid, profile)

    new_message = InquiryMessage(
        id=uuid.uuid4(),
        inquiry_id=thread_uuid,
        sender_id=user_id,
        content=data.content,
        image_url=data.image_url,
        is_ai_generated=data.is_ai_generated,
    )
    db.add(new_message)
    thread.updated_at = func.now()
    db.commit()
    db.refresh(new_message)

    recipient_id = thread.assigned_broker if user_id == thread.created_by else thread.created_by
    if recipient_id and recipient_id != user_id:
        db.add(
            Notification(
                id=uuid.uuid4(),
                user_id=recipient_id,
                type="INQUIRY_REPLY",
                title="Phan hoi moi",
                message=f"{profile.full_name or 'Ai do'} da tra loi chu de: {thread.title}",
                link=str(thread.id),
            )
        )
        db.commit()

    return {
        "id": str(new_message.id),
        "content": new_message.content,
        "image_url": new_message.image_url,
        "sender_id": str(new_message.sender_id),
        "sender_name": profile.full_name or ("AI Assistant" if data.is_ai_generated else "Unknown"),
        "sender_avatar": profile.avatar_url,
        "is_ai_generated": new_message.is_ai_generated,
        "created_at": new_message.created_at,
    }
