from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from src.database import get_db
from src.models.schema import Notification
from src.shared.auth.dependencies import CurrentActor, get_current_actor
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/v1/notification", tags=["Notification"])

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

@router.get("", response_model=List[NotificationResponse])
async def get_notifications(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Lấy danh sách thông báo của người dùng."""
    u_id = uuid.UUID(actor.id)
    notifications = db.query(Notification).filter(Notification.user_id == u_id).order_by(Notification.created_at.desc()).limit(50).all()
    
    return [
        {
            "id": str(n.id),
            "user_id": str(n.user_id),
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "link": n.link,
            "is_read": n.is_read,
            "created_at": n.created_at
        } for n in notifications
    ]

@router.post("/{notification_id}/read")
async def mark_as_read(notification_id: str, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Đánh dấu thông báo là đã đọc."""
    n_id = uuid.UUID(notification_id)
    u_id = uuid.UUID(actor.id)
    notification = db.query(Notification).filter(Notification.id == n_id, Notification.user_id == u_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Thông báo không tồn tại")
    
    notification.is_read = True
    db.commit()
    return {"status": "success"}

@router.post("/read-all")
async def mark_all_as_read(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Đánh dấu tất cả thông báo là đã đọc."""
    u_id = uuid.UUID(actor.id)
    db.query(Notification).filter(Notification.user_id == u_id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"status": "success"}
