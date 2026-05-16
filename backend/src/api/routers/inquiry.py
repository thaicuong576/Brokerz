from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from src.database import get_db
from src.models.schema import Inquiry, InquiryMessage, Profile, Notification
from src.shared.auth.dependencies import CurrentActor, get_current_actor
import uuid
from datetime import datetime

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

@router.get("/threads", response_model=List[ThreadResponse])
async def get_threads(user_id: str = "", actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Lấy danh sách các thread hỏi đáp dựa trên role và link."""
    u_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == u_id).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    query = db.query(Inquiry)
    
    if profile.role == "BROKER":
        # Broker chỉ thấy threads được gán cho chính mình
        query = query.filter(Inquiry.assigned_broker == u_id)
    else:
        # Investor:
        broker_id = profile.linked_broker_id
        if broker_id:
            # Logic "Broker-Centric":
            # 1. Thread phải thuộc về Broker đang kết nối
            # 2. VÀ (Là thread của chính mình HOẶC là thread công khai của người khác)
            query = query.filter(
                (Inquiry.assigned_broker == broker_id) & 
                (
                    (Inquiry.created_by == u_id) | # Bài của mình gửi cho broker này
                    (Inquiry.is_private == False)   # Bài Public của người khác gửi cho broker này
                )
            )
        else:
            # Nếu chưa link broker, không thấy gì cả
            return []
            
    threads = query.order_by(Inquiry.updated_at.desc()).all()
    
    result = []
    for t in threads:
        author = db.query(Profile).filter(Profile.id == t.created_by).first()
        msg_count = db.query(InquiryMessage).filter(InquiryMessage.inquiry_id == t.id).count()
        result.append({
            "id": str(t.id),
            "title": t.title,
            "status": t.status,
            "is_private": t.is_private,
            "image_url": t.image_url,
            "created_by": str(t.created_by),
            "author_name": author.full_name if author else "User",
            "author_avatar": author.avatar_url if author else None,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "message_count": msg_count
        })
        
    return result

@router.post("/threads", response_model=ThreadResponse)
async def create_thread(data: ThreadCreate, user_id: str = "", actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Tạo một thread hỏi đáp mới."""
    u_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == u_id).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    if profile.role == "BROKER":
        # Broker tạo thread cho chính mình (public announcement hoặc similar)
        assigned_broker = u_id
    else:
        # Investor tạo thread, gán cho broker đang theo dõi
        assigned_broker = profile.linked_broker_id
        if not assigned_broker:
            raise HTTPException(status_code=400, detail="You must link to a Broker via SoulKey first.")
            
    new_inquiry = Inquiry(
        title=data.title,
        is_private=data.is_private,
        image_url=data.image_url,
        created_by=u_id,
        assigned_broker=assigned_broker,
        status="OPEN"
    )
    db.add(new_inquiry)
    db.flush() # Lấy ID
    
    # Tạo tin nhắn đầu tiên
    first_msg = InquiryMessage(
        inquiry_id=new_inquiry.id,
        sender_id=u_id,
        content=data.initial_message,
        image_url=data.image_url,
        is_ai_generated=False
    )
    db.add(first_msg)
    db.commit()
    db.refresh(new_inquiry)
    
    return {
        "id": str(new_inquiry.id),
        "title": new_inquiry.title,
        "status": new_inquiry.status,
        "is_private": new_inquiry.is_private,
        "image_url": new_inquiry.image_url,
        "created_by": str(new_inquiry.created_by),
        "author_name": profile.full_name,
        "author_avatar": profile.avatar_url,
        "created_at": new_inquiry.created_at,
        "updated_at": new_inquiry.updated_at,
        "message_count": 1
    }

@router.get("/threads/{thread_id}/messages", response_model=List[MessageResponse])
async def get_thread_messages(thread_id: str, db: Session = Depends(get_db)):
    """Lấy tất cả tin nhắn trong một thread."""
    t_id = uuid.UUID(thread_id)
    messages = db.query(InquiryMessage).filter(InquiryMessage.inquiry_id == t_id).order_by(InquiryMessage.created_at.asc()).all()
    
    result = []
    for m in messages:
        sender = db.query(Profile).filter(Profile.id == m.sender_id).first()
        result.append({
            "id": str(m.id),
            "content": m.content,
            "image_url": m.image_url,
            "sender_id": str(m.sender_id),
            "sender_name": sender.full_name if sender else "AI Assistant" if m.is_ai_generated else "Unknown",
            "sender_avatar": sender.avatar_url if sender else None,
            "is_ai_generated": m.is_ai_generated,
            "created_at": m.created_at
        })
    return result

@router.post("/threads/{thread_id}/messages", response_model=MessageResponse)
async def add_message(thread_id: str, data: MessageCreate, user_id: str = "", actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Thêm tin nhắn trả lời vào thread."""
    t_id = uuid.UUID(thread_id)
    u_id = uuid.UUID(actor.id)
    
    # Check if thread exists
    thread = db.query(Inquiry).filter(Inquiry.id == t_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    new_msg = InquiryMessage(
        inquiry_id=t_id,
        sender_id=u_id,
        content=data.content,
        image_url=data.image_url,
        is_ai_generated=data.is_ai_generated
    )
    db.add(new_msg)
    
    # Update thread timestamp
    thread.updated_at = func.now()
    db.commit()
    db.refresh(new_msg)
    
    sender = db.query(Profile).filter(Profile.id == u_id).first()

    # Create notification for the other party
    recipient_id = None
    if u_id == thread.created_by:
        # Investor replied, notify Broker
        recipient_id = thread.assigned_broker
    else:
        # Broker (or someone else) replied, notify Thread Creator
        recipient_id = thread.created_by
    
    if recipient_id and recipient_id != u_id:
        notification = Notification(
            user_id=recipient_id,
            type="INQUIRY_REPLY",
            title="Phản hồi mới",
            message=f"{sender.full_name if sender else 'Ai đó'} đã trả lời chủ đề: {thread.title}",
            link=str(thread.id)
        )
        db.add(notification)
        db.commit()
    
    return {
        "id": str(new_msg.id),
        "content": new_msg.content,
        "image_url": new_msg.image_url,
        "sender_id": str(new_msg.sender_id),
        "sender_name": sender.full_name if sender else "AI Assistant" if data.is_ai_generated else "Unknown",
        "sender_avatar": sender.avatar_url if sender else None,
        "is_ai_generated": new_msg.is_ai_generated,
        "created_at": new_msg.created_at
    }
