from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID, uuid4

from src.database import get_db
from src.models.schema import BrokerWorkspace, Portfolio, PortfolioItem, Profile, Notification, WorkspaceMembership, MarketPrice
from sqlalchemy.orm import joinedload
from src.shared.auth.dependencies import CurrentActor, get_current_actor
from sqlalchemy import func
from datetime import date

router = APIRouter(prefix="/api/v1/portfolio", tags=["Portfolio"])


def _get_target_broker_id(db: Session, profile: Optional[Profile], user_id: UUID) -> Optional[UUID]:
    if not profile:
        return None
    if profile.role == "BROKER":
        return user_id

    membership = db.query(WorkspaceMembership).filter(
        WorkspaceMembership.profile_id == user_id,
        WorkspaceMembership.status == "ACTIVE"
    ).first()
    if not membership:
        return None

    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.id == membership.workspace_id).first()
    if not workspace:
        return None
    return workspace.owner_profile_id

# --- PYDANTIC MODELS ---
class PortfolioItemSchema(BaseModel):
    symbol: str
    weight: float
    entry_price: Optional[float] = None
    reason: Optional[str] = None

    class Config:
        from_attributes = True

class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None
    items: List[PortfolioItemSchema]

class PortfolioResponse(BaseModel):
    id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    items: List[PortfolioItemSchema] = []

    class Config:
        from_attributes = True

# --- RECOMMENDATION MODELS ---
class RecommendationSchema(BaseModel):
    symbol: str
    type: str # BUY / SELL
    reason: Optional[str] = None

class RecommendationResponse(BaseModel):
    id: UUID
    symbol: str
    type: str
    reason: Optional[str] = None
    trading_date: Optional[date] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- ENDPOINTS ---

@router.get("/my-strategy", response_model=Optional[PortfolioResponse])
async def get_my_strategy(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Lấy danh mục chiến thuật (của Broker hoặc của Broker liên kết nếu là Investor)."""
    user_id = UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    target_broker_id = _get_target_broker_id(db, profile, user_id)
    if not target_broker_id:
        return None

    portfolio = db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.created_by == target_broker_id).first()
    return portfolio

@router.post("/sync-strategy", response_model=PortfolioResponse)
async def sync_strategy(data: PortfolioBase, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Đồng bộ danh mục chiến thuật của Broker."""
    user_id = UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile or profile.role != "BROKER":
        raise HTTPException(status_code=403, detail="Chỉ Broker mới có quyền đồng bộ chiến thuật")

    existing_p = db.query(Portfolio).filter(Portfolio.created_by == user_id).first()
    
    if existing_p:
        db.query(PortfolioItem).filter(PortfolioItem.portfolio_id == existing_p.id).delete()
        existing_p.name = data.name
        existing_p.description = data.description
        p_id = existing_p.id
    else:
        new_p = Portfolio(
            id=uuid4(),
            name=data.name,
            description=data.description,
            created_by=user_id,
            is_public=True
        )
        db.add(new_p)
        db.flush()
        p_id = new_p.id

    for item in data.items:
        db.add(PortfolioItem(
            portfolio_id=p_id,
            symbol=item.symbol,
            weight=item.weight,
            entry_price=item.entry_price,
            reason=item.reason
        ))
    
    db.commit()
    return db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.id == p_id).first()

@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio_details(portfolio_id: UUID, db: Session = Depends(get_db)):
    """Lấy chi tiết một danh mục cụ thể (Public)."""
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    return portfolio
