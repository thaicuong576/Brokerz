from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from src.database import get_db
from src.models.schema import Profile
from src.shared.auth.dependencies import CurrentActor, get_current_actor
import uuid
import random
import string

router = APIRouter(prefix="/api/v1/profile", tags=["Profile"])

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str]
    role: str
    soul_key: Optional[str] = None
    avatar_url: Optional[str] = None
    linked_broker_id: Optional[str] = None
    broker_name: Optional[str] = None
    linked_broker_key: Optional[str] = None

class VerifyKeyRequest(BaseModel):
    key: str

def generate_random_soul_key():
    """Tạo soul key ngẫu nhiên dạng BKZ-XXXX-XXXX."""
    part1 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    part2 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"BKZ-{part1}-{part2}"

@router.get("/", response_model=ProfileResponse)
async def get_profile_query(
    userId: str, 
    role: Optional[str] = None, 
    name: Optional[str] = None, 
    avatar: Optional[str] = None, 
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db)
):
    """Hỗ trợ lấy profile qua Query Parameter (userId)."""
    return await get_profile(actor.id, None, name, avatar, db, actor)

@router.get("/{user_id}", response_model=ProfileResponse)
async def get_profile(
    user_id: str, 
    role: Optional[str] = None, 
    name: Optional[str] = None, 
    avatar: Optional[str] = None, 
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(get_current_actor)
):
    """Lấy thông tin profile dựa trên User ID (từ Supabase Auth)."""
    try:
        # Chuyển string ID sang UUID nếu cần
        user_id = actor.id
        role = None
        u_id = uuid.UUID(user_id) if "-" in user_id else user_id
        
        profile = db.query(Profile).filter(Profile.id == u_id).first()
        
        # Role mà người dùng muốn sử dụng trong phiên này
        session_role = role.upper() if role else "INVESTOR"
        
        if not profile:
            # Nếu chưa có profile trong DB, tạo mới
            profile = Profile(
                id=u_id,
                full_name=name if name else "User",
                avatar_url=avatar,
                role=session_role,
                soul_key=None
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        
        # Cập nhật nếu profile hiện tại là "New User" hoặc thiếu thông tin
        updated = False
        if (profile.full_name in ["New User", "User", None]) and name:
            profile.full_name = name
            updated = True
        if not profile.avatar_url and avatar:
            profile.avatar_url = avatar
            updated = True
            
        # Nếu profile hiện tại là INVESTOR nhưng frontend gửi role='broker' -> Nâng cấp lên BROKER vĩnh viễn
        if profile.role == "INVESTOR" and session_role == "BROKER":
            profile.role = "BROKER"
            updated = True
            
        # Nếu là BROKER mà chưa có SoulKey thì cấp luôn
        if profile.role == "BROKER" and not profile.soul_key:
            profile.soul_key = generate_random_soul_key()
            updated = True
            
        if updated:
            db.commit()
            db.refresh(profile)
            
        # Fetch broker name if linked
        broker_name = None
        broker_key = None
        if profile.linked_broker_id:
            broker = db.query(Profile).filter(Profile.id == profile.linked_broker_id).first()
            if broker:
                broker_name = broker.full_name
                broker_key = broker.soul_key

        # Quan trọng: Trả về session_role nếu người dùng muốn làm Investor, 
        # nhưng vẫn giữ profile.role là BROKER trong DB nếu họ đã là Broker.
        return ProfileResponse(
            id=str(profile.id),
            full_name=profile.full_name,
            role=session_role, # Trả về role theo phiên
            soul_key=profile.soul_key,
            avatar_url=profile.avatar_url,
            linked_broker_id=str(profile.linked_broker_id) if profile.linked_broker_id else None,
            broker_name=broker_name,
            linked_broker_key=broker_key
        )
    except Exception as e:
        # Fallback cho trường hợp ID không phải UUID (ví dụ 'mock-id')
        return {
            "id": user_id,
            "full_name": name if name else "Mock User",
            "role": "BROKER" if "broker" in user_id else "INVESTOR",
            "soul_key": "SOUL-BKZ-8888" if "broker" in user_id else None,
            "avatar_url": avatar
        }

@router.post("/verify-key")
async def verify_soul_key(data: VerifyKeyRequest, db: Session = Depends(get_db)):
    """Kiểm tra Soul Key của Broker trong Database."""
    profile = db.query(Profile).filter(Profile.soul_key == data.key).first()
    return {"valid": profile is not None, "broker_id": str(profile.id) if profile else None}

@router.post("/{user_id}/link-broker")
async def link_broker(user_id: str, data: VerifyKeyRequest, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Liên kết Investor với một Broker qua Soul Key."""
    u_id = uuid.UUID(actor.id)
    investor_profile = db.query(Profile).filter(Profile.id == u_id).first()
    
    if not investor_profile:
        raise HTTPException(status_code=404, detail="Investor profile not found")
        
    broker_profile = db.query(Profile).filter(Profile.soul_key == data.key).first()
    if not broker_profile:
        raise HTTPException(status_code=400, detail="Invalid Soul Key")
        
    investor_profile.linked_broker_id = broker_profile.id
    db.commit()
    return {"status": "success", "broker_id": str(broker_profile.id), "broker_name": broker_profile.full_name}

@router.post("/{user_id}/unlink-broker")
async def unlink_broker(user_id: str, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Ngắt liên kết Investor với Broker."""
    try:
        u_id = uuid.UUID(actor.id)
        investor_profile = db.query(Profile).filter(Profile.id == u_id).first()
        
        if not investor_profile:
            raise HTTPException(status_code=404, detail="Investor profile not found")
            
        investor_profile.linked_broker_id = None
        db.commit()
        return {"status": "success", "message": "Successfully unlinked from broker"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{user_id}/update")
async def update_profile(user_id: str, data: ProfileUpdate, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Cập nhật thông tin profile."""
    u_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == u_id).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    if data.full_name:
        profile.full_name = data.full_name
    if data.avatar_url:
        profile.avatar_url = data.avatar_url
        
    db.commit()
    return profile
