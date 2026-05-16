from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.database import get_db
from src.modules.identity.service import get_or_create_profile
from src.shared.auth.dependencies import CurrentActor, get_current_actor

router = APIRouter(prefix="/api/v1", tags=["Identity"])


class MeResponse(BaseModel):
    id: str
    email: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    role: str


@router.get("/me", response_model=MeResponse)
def get_me(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    profile = get_or_create_profile(db, actor)
    return MeResponse(
        id=str(profile.id),
        email=profile.email,
        full_name=profile.full_name,
        avatar_url=profile.avatar_url,
        role=profile.role,
    )
