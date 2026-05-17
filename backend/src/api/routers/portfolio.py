from datetime import date, datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from src.database import get_db
from src.models.schema import BrokerWorkspace, Portfolio, PortfolioEvent, PortfolioItem, Profile, WorkspaceMembership
from src.shared.auth.dependencies import CurrentActor, get_current_actor

router = APIRouter(prefix="/api/v1/portfolio", tags=["Portfolio"])


def _get_target_broker_id(db: Session, profile: Optional[Profile], user_id: UUID) -> Optional[UUID]:
    if not profile:
        return None
    if profile.role == "BROKER":
        return user_id

    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.profile_id == user_id, WorkspaceMembership.status == "ACTIVE")
        .first()
    )
    if not membership:
        return None

    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.id == membership.workspace_id).first()
    return workspace.owner_profile_id if workspace else None


def _get_viewer_workspace(db: Session, profile: Profile) -> Optional[BrokerWorkspace]:
    if profile.role == "BROKER":
        return db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()

    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.profile_id == profile.id, WorkspaceMembership.status == "ACTIVE")
        .first()
    )
    if not membership:
        return None
    return db.query(BrokerWorkspace).filter(BrokerWorkspace.id == membership.workspace_id).first()


def _portfolio_snapshot(portfolio: Optional[Portfolio]) -> str:
    if not portfolio:
        return "[]"
    import json

    return json.dumps(
        [
            {
                "symbol": item.symbol,
                "weight": item.weight,
                "entry_price": item.entry_price,
                "active_thesis": item.active_thesis,
                "source_recommendation_id": str(item.source_recommendation_id) if item.source_recommendation_id else None,
            }
            for item in portfolio.items
        ],
        ensure_ascii=False,
        default=str,
    )


class PortfolioItemSchema(BaseModel):
    symbol: str
    weight: float
    entry_price: Optional[float] = None
    active_thesis: Optional[str] = None
    source_recommendation_id: Optional[UUID] = None
    updated_at: Optional[datetime] = None
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None
    items: List[PortfolioItemSchema]


class PortfolioResponse(BaseModel):
    id: Optional[UUID] = None
    workspace_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    items: List[PortfolioItemSchema] = []

    class Config:
        from_attributes = True


class RecommendationSchema(BaseModel):
    symbol: str
    type: str
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


@router.get("/current", response_model=Optional[PortfolioResponse])
async def get_current_portfolio(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    user_id = UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        return None

    workspace = _get_viewer_workspace(db, profile)
    if not workspace:
        return None

    return (
        db.query(Portfolio)
        .options(joinedload(Portfolio.items))
        .filter(Portfolio.workspace_id == workspace.id)
        .first()
    )


@router.get("/my-strategy", response_model=Optional[PortfolioResponse])
async def get_my_strategy(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Lấy danh mục chiến thuật của broker hoặc broker mà investor đang theo dõi."""
    user_id = UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    target_broker_id = _get_target_broker_id(db, profile, user_id)
    if not target_broker_id:
        return None

    workspace = _get_viewer_workspace(db, profile) if profile else None
    portfolio = None
    if workspace:
        portfolio = (
            db.query(Portfolio)
            .options(joinedload(Portfolio.items))
            .filter(Portfolio.workspace_id == workspace.id)
            .first()
        )
    if not portfolio:
        portfolio = (
            db.query(Portfolio)
            .options(joinedload(Portfolio.items))
            .filter(Portfolio.created_by == target_broker_id)
            .first()
        )
    return portfolio


@router.post("/sync-strategy", response_model=PortfolioResponse)
async def sync_strategy(data: PortfolioBase, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Đồng bộ danh mục thủ công của broker."""
    user_id = UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile or profile.role != "BROKER":
        raise HTTPException(status_code=403, detail="Chỉ broker mới có quyền đồng bộ danh mục")

    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == user_id).first()
    existing_p = None
    if workspace:
        existing_p = (
            db.query(Portfolio)
            .options(joinedload(Portfolio.items))
            .filter(Portfolio.workspace_id == workspace.id)
            .first()
        )
    if not existing_p:
        existing_p = (
            db.query(Portfolio)
            .options(joinedload(Portfolio.items))
            .filter(Portfolio.created_by == user_id)
            .first()
        )

    if existing_p:
        before_state = _portfolio_snapshot(existing_p)
        db.query(PortfolioItem).filter(PortfolioItem.portfolio_id == existing_p.id).delete()
        existing_p.workspace_id = existing_p.workspace_id or (workspace.id if workspace else None)
        existing_p.name = data.name
        existing_p.description = data.description
        p_id = existing_p.id
    else:
        portfolio = Portfolio(
            id=uuid4(),
            workspace_id=workspace.id if workspace else None,
            name=data.name,
            description=data.description,
            created_by=user_id,
            is_public=True,
        )
        db.add(portfolio)
        db.flush()
        before_state = "[]"
        p_id = portfolio.id

    for item in data.items:
        db.add(
            PortfolioItem(
                portfolio_id=p_id,
                symbol=item.symbol,
                weight=item.weight,
                entry_price=item.entry_price,
                active_thesis=item.active_thesis or item.reason,
                reason=item.reason,
            )
        )

    db.flush()
    portfolio = db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.id == p_id).first()
    if portfolio and portfolio.workspace_id:
        db.add(
            PortfolioEvent(
                id=uuid4(),
                workspace_id=portfolio.workspace_id,
                recommendation_id=None,
                event_type="MANUAL_SYNC",
                before_state=before_state,
                after_state=_portfolio_snapshot(portfolio),
                note="Broker chỉnh danh mục thủ công",
                created_by=user_id,
            )
        )
    db.commit()
    return db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.id == p_id).first()


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio_details(portfolio_id: UUID, db: Session = Depends(get_db)):
    """Lấy chi tiết một danh mục public."""
    portfolio = db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    return portfolio
