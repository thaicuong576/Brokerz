import json
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from src.database import get_db
from src.models.schema import (
    BrokerWorkspace,
    Notification,
    Portfolio,
    PortfolioEvent,
    PortfolioItem,
    Profile,
    RecommendationEvent,
    WorkspaceMembership,
    WsRecommendation,
)
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


def _recommendation_snapshot(rec: WsRecommendation) -> str:
    return json.dumps(
        {
            "status": rec.status,
            "symbol": rec.symbol,
            "side": rec.side,
            "action_type": rec.action_type,
            "entry_price": rec.entry_price,
            "target_price": rec.target_price,
            "cutloss_price": rec.cutloss_price,
            "thesis": rec.thesis,
            "risk_note": rec.risk_note,
            "published_at": rec.published_at,
        },
        ensure_ascii=False,
        default=str,
    )


def _get_or_create_workspace_portfolio(db: Session, workspace: BrokerWorkspace, broker_id: UUID) -> Portfolio:
    portfolio = (
        db.query(Portfolio)
        .options(joinedload(Portfolio.items))
        .filter(Portfolio.workspace_id == workspace.id)
        .first()
    )
    if portfolio:
        return portfolio

    portfolio = Portfolio(
        id=uuid4(),
        workspace_id=workspace.id,
        name=f"{workspace.name} - Danh mục hiện tại",
        description="Model portfolio hiện tại của broker",
        created_by=broker_id,
        is_public=True,
    )
    db.add(portfolio)
    db.flush()
    db.refresh(portfolio)
    return portfolio


def _parse_portfolio_state(value: Optional[str]) -> Dict[str, Dict[str, Any]]:
    if not value:
        return {}
    try:
        rows = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}
    if not isinstance(rows, list):
        return {}
    return {
        str(row.get("symbol", "")).upper(): row
        for row in rows
        if isinstance(row, dict) and row.get("symbol")
    }


def _event_action(previous_weight: float, current_weight: float) -> str:
    if current_weight == 0:
        return "SELL_ALL"
    if previous_weight == 0 and current_weight > 0:
        return "BUY_NEW"
    if current_weight > previous_weight:
        return "INCREASE"
    if current_weight < previous_weight:
        return "DECREASE"
    return "THESIS_UPDATE"


def _portfolio_event_summary(event: PortfolioEvent) -> Optional[Dict[str, Any]]:
    before = _parse_portfolio_state(event.before_state)
    after = _parse_portfolio_state(event.after_state)
    symbols = sorted(set(before.keys()) | set(after.keys()))
    changed_symbol = None
    for symbol in symbols:
        before_row = before.get(symbol, {})
        after_row = after.get(symbol, {})
        if before_row.get("weight") != after_row.get("weight") or before_row.get("active_thesis") != after_row.get("active_thesis"):
            changed_symbol = symbol
            break
    if not changed_symbol:
        changed_symbol = symbols[0] if symbols else None
    if not changed_symbol:
        return None

    before_row = before.get(changed_symbol, {})
    after_row = after.get(changed_symbol, {})
    previous_weight = float(before_row.get("weight") or 0)
    current_weight = float(after_row.get("weight") or 0)
    action = event.event_type if event.event_type in {"BUY_NEW", "INCREASE", "DECREASE", "SELL_ALL", "THESIS_UPDATE"} else _event_action(previous_weight, current_weight)
    applied_price = after_row.get("entry_price") if current_weight > 0 else before_row.get("entry_price")
    return {
        "id": event.id,
        "symbol": changed_symbol,
        "action": action,
        "previous_weight": previous_weight,
        "current_weight": current_weight,
        "note": event.note,
        "applied_price": applied_price,
        "created_at": event.created_at,
        "recommendation_id": event.recommendation_id,
    }


def _enriched_portfolio_response(db: Session, portfolio: Optional[Portfolio]) -> Optional[Dict[str, Any]]:
    if not portfolio:
        return None

    events = (
        db.query(PortfolioEvent)
        .filter(PortfolioEvent.workspace_id == portfolio.workspace_id)
        .order_by(PortfolioEvent.created_at.desc())
        .all()
        if portfolio.workspace_id
        else []
    )
    latest_by_symbol: Dict[str, Dict[str, Any]] = {}
    latest_event_at = None
    for event in events:
        if not latest_event_at:
            latest_event_at = event.created_at
        summary = _portfolio_event_summary(event)
        if summary and summary["symbol"] not in latest_by_symbol and summary["current_weight"] > 0:
            latest_by_symbol[summary["symbol"]] = summary

    return {
        "id": portfolio.id,
        "workspace_id": portfolio.workspace_id,
        "name": portfolio.name,
        "description": portfolio.description,
        "created_by": portfolio.created_by,
        "created_at": portfolio.created_at,
        "latest_event_at": latest_event_at,
        "items": [
            {
                "symbol": item.symbol,
                "weight": item.weight,
                "entry_price": item.entry_price,
                "active_thesis": item.active_thesis,
                "source_recommendation_id": item.source_recommendation_id,
                "updated_at": item.updated_at,
                "reason": item.reason,
                "last_action": latest_by_symbol.get(item.symbol, {}).get("action"),
                "previous_weight": latest_by_symbol.get(item.symbol, {}).get("previous_weight"),
                "current_weight": item.weight,
                "last_event_at": latest_by_symbol.get(item.symbol, {}).get("created_at"),
                "last_event_note": latest_by_symbol.get(item.symbol, {}).get("note"),
            }
            for item in portfolio.items
            if item.weight > 0
        ],
    }


class PortfolioItemSchema(BaseModel):
    symbol: str
    weight: float
    entry_price: Optional[float] = None
    active_thesis: Optional[str] = None
    source_recommendation_id: Optional[UUID] = None
    updated_at: Optional[datetime] = None
    reason: Optional[str] = None
    last_action: Optional[str] = None
    previous_weight: Optional[float] = None
    current_weight: Optional[float] = None
    last_event_at: Optional[datetime] = None
    last_event_note: Optional[str] = None

    class Config:
        from_attributes = True


class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None
    items: List[PortfolioItemSchema]


class PositionUpdateRequest(BaseModel):
    symbol: str
    target_weight: float
    applied_price: Optional[float] = None
    thesis: Optional[str] = None
    risk_note: Optional[str] = None
    publish: bool = True


class PortfolioResponse(BaseModel):
    id: Optional[UUID] = None
    workspace_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    latest_event_at: Optional[datetime] = None
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


class PortfolioUpdateResponse(BaseModel):
    id: UUID
    symbol: str
    action: str
    previous_weight: float
    current_weight: float
    note: Optional[str] = None
    applied_price: Optional[float] = None
    created_at: Optional[datetime] = None
    recommendation_id: Optional[UUID] = None


@router.get("/current", response_model=Optional[PortfolioResponse])
async def get_current_portfolio(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    user_id = UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        return None

    workspace = _get_viewer_workspace(db, profile)
    if not workspace:
        return None

    portfolio = (
        db.query(Portfolio)
        .options(joinedload(Portfolio.items))
        .filter(Portfolio.workspace_id == workspace.id)
        .first()
    )
    return _enriched_portfolio_response(db, portfolio)


@router.post("/update-position", response_model=PortfolioResponse)
async def update_position(data: PositionUpdateRequest, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Cập nhật trực tiếp danh mục hiện tại; có thể công bố thay đổi cho nhà đầu tư."""
    user_id = UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile or profile.role != "BROKER":
        raise HTTPException(status_code=403, detail="Chỉ broker mới có quyền cập nhật danh mục")

    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == user_id).first()
    if not workspace:
        raise HTTPException(status_code=400, detail="Broker workspace chưa được khởi tạo")

    symbol = data.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Mã cổ phiếu không được để trống")
    if data.target_weight < 0:
        raise HTTPException(status_code=400, detail="Tỷ trọng mới phải >= 0")

    portfolio = _get_or_create_workspace_portfolio(db, workspace, user_id)
    before_state = _portfolio_snapshot(portfolio)
    item = (
        db.query(PortfolioItem)
        .filter(PortfolioItem.portfolio_id == portfolio.id, PortfolioItem.symbol == symbol)
        .first()
    )
    previous_weight = item.weight if item else 0
    other_weight = sum(position.weight for position in portfolio.items if position.symbol != symbol)
    next_total_weight = other_weight + data.target_weight
    if next_total_weight > 100.0001:
        raise HTTPException(status_code=400, detail="Tổng tỷ trọng danh mục không được vượt 100%")
    if data.target_weight == 0 and not item:
        raise HTTPException(status_code=400, detail="Mã này chưa có trong danh mục")

    portfolio_action = _event_action(previous_weight, data.target_weight)
    if data.target_weight == 0:
        if item in portfolio.items:
            portfolio.items.remove(item)
        db.delete(item)
    elif item:
        item.weight = data.target_weight
        item.entry_price = data.applied_price or item.entry_price
        item.active_thesis = data.thesis or item.active_thesis
        item.reason = data.thesis or item.reason
    else:
        item = PortfolioItem(
            id=uuid4(),
            portfolio_id=portfolio.id,
            symbol=symbol,
            weight=data.target_weight,
            entry_price=data.applied_price,
            active_thesis=data.thesis,
            reason=data.thesis,
        )
        portfolio.items.append(item)

    recommendation_id = None
    if data.publish:
        now = datetime.now(timezone.utc)
        side = "SELL" if portfolio_action in {"DECREASE", "SELL_ALL"} else "BUY"
        rec = WsRecommendation(
            id=uuid4(),
            workspace_id=workspace.id,
            broker_id=user_id,
            symbol=symbol,
            side=side,
            action_type=side,
            status="PUBLISHED",
            entry_price=data.applied_price,
            thesis=data.thesis,
            risk_note=data.risk_note,
            published_at=now,
        )
        db.add(rec)
        db.flush()
        recommendation_id = rec.id
        db.add(
            RecommendationEvent(
                recommendation_id=rec.id,
                event_type="CREATED",
                actor_id=user_id,
                before_state="{}",
                after_state=_recommendation_snapshot(rec),
                note="Tạo từ cập nhật danh mục",
            )
        )
        db.add(
            RecommendationEvent(
                recommendation_id=rec.id,
                event_type="PUBLISHED",
                actor_id=user_id,
                before_state="{}",
                after_state=_recommendation_snapshot(rec),
                note="Công bố cập nhật danh mục",
            )
        )

        members = db.query(WorkspaceMembership).filter(
            WorkspaceMembership.workspace_id == workspace.id,
            WorkspaceMembership.status == "ACTIVE",
            WorkspaceMembership.profile_id != user_id,
        ).all()
        for member in members:
            db.add(
                Notification(
                    user_id=member.profile_id,
                    type="RECOMMENDATION",
                    title="Cập nhật danh mục",
                    message=f"Broker vừa cập nhật tỷ trọng {symbol} từ {previous_weight:g}% thành {data.target_weight:g}%",
                    link=str(rec.id),
                )
            )

        if data.target_weight > 0 and item:
            item.source_recommendation_id = rec.id

    db.flush()
    portfolio = db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.id == portfolio.id).first()
    db.add(
        PortfolioEvent(
            id=uuid4(),
            workspace_id=workspace.id,
            recommendation_id=recommendation_id,
            event_type=portfolio_action,
            before_state=before_state,
            after_state=_portfolio_snapshot(portfolio),
            note=data.thesis,
            created_by=user_id,
        )
    )
    db.commit()
    portfolio = db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.id == portfolio.id).first()
    return _enriched_portfolio_response(db, portfolio)


@router.get("/events", response_model=List[PortfolioUpdateResponse])
async def get_portfolio_events(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    user_id = UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        return []

    workspace = _get_viewer_workspace(db, profile)
    if not workspace:
        return []

    query = db.query(PortfolioEvent).filter(PortfolioEvent.workspace_id == workspace.id)
    if profile.role != "BROKER":
        query = query.filter(PortfolioEvent.recommendation_id.isnot(None))

    summaries = []
    for event in query.order_by(PortfolioEvent.created_at.desc()).limit(30).all():
        summary = _portfolio_event_summary(event)
        if summary:
            summaries.append(summary)
    return summaries


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
