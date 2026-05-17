import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from src.database import get_db
from src.models.schema import (
    BrokerWorkspace,
    MarketPrice,
    Notification,
    Portfolio,
    PortfolioEvent,
    PortfolioItem,
    Profile,
    RecommendationEvent,
    WorkspaceMembership,
    WsRecommendation,
)
from src.modules.identity.service import get_or_create_profile
from src.shared.auth.dependencies import CurrentActor, get_current_actor


router = APIRouter(prefix="/api/v1/recommendations", tags=["Recommendations"])


class RecommendationCreate(BaseModel):
    symbol: str
    side: str
    action_type: Optional[str] = None
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    cutloss_price: Optional[float] = None
    thesis: Optional[str] = None
    risk_note: Optional[str] = None


class ThesisUpdate(BaseModel):
    thesis: Optional[str] = None
    target_price: Optional[float] = None
    cutloss_price: Optional[float] = None
    risk_note: Optional[str] = None
    note: Optional[str] = None


class CloseRequest(BaseModel):
    reason: str
    note: Optional[str] = None


class ApplyToPortfolioRequest(BaseModel):
    weight: float
    applied_price: Optional[float] = None
    note: Optional[str] = None


class ReverseRequest(BaseModel):
    close_price: Optional[float] = None
    close_note: Optional[str] = None
    new_entry_price: Optional[float] = None
    target_price: Optional[float] = None
    cutloss_price: Optional[float] = None
    thesis: Optional[str] = None
    risk_note: Optional[str] = None


class RecommendationResponse(BaseModel):
    id: str
    workspace_id: str
    broker_id: str
    symbol: str
    side: str
    action_type: str
    status: str
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    cutloss_price: Optional[float] = None
    thesis: Optional[str] = None
    risk_note: Optional[str] = None
    closed_reason: Optional[str] = None
    applied_at: Optional[datetime] = None
    applied_portfolio_event_id: Optional[str] = None
    parent_recommendation_id: Optional[str] = None
    current_price: Optional[float] = None
    performance_pct: Optional[float] = None
    published_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EventResponse(BaseModel):
    id: str
    event_type: str
    actor_id: str
    note: Optional[str] = None
    before_state: Optional[str] = None
    after_state: Optional[str] = None
    created_at: Optional[datetime] = None


def _get_broker_workspace(db: Session, profile: Profile) -> BrokerWorkspace:
    if profile.role != "BROKER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only brokers can manage recommendations")
    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broker workspace not set up. Bootstrap first.")
    return workspace


def _get_viewer_workspace_id(db: Session, profile: Profile) -> Optional[uuid.UUID]:
    if profile.role == "BROKER":
        ws = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
        return ws.id if ws else None
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.profile_id == profile.id, WorkspaceMembership.status == "ACTIVE")
        .first()
    )
    return membership.workspace_id if membership else None


def _get_broker_recommendation(db: Session, workspace: BrokerWorkspace, rec_id: uuid.UUID) -> WsRecommendation:
    rec = db.query(WsRecommendation).filter(
        WsRecommendation.id == rec_id,
        WsRecommendation.workspace_id == workspace.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec


def _snapshot(rec: WsRecommendation) -> str:
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
            "closed_reason": rec.closed_reason,
            "applied_at": rec.applied_at,
        },
        ensure_ascii=False,
        default=str,
    )


def _add_event(db: Session, rec: WsRecommendation, event_type: str, actor_id: uuid.UUID, before: str, note: Optional[str] = None):
    db.add(RecommendationEvent(
        recommendation_id=rec.id,
        event_type=event_type,
        actor_id=actor_id,
        before_state=before,
        after_state=_snapshot(rec),
        note=note,
    ))


def _latest_prices(db: Session, symbols: list[str]) -> dict[str, float]:
    if not symbols:
        return {}
    latest_date = db.query(func.max(MarketPrice.trading_date)).scalar()
    if not latest_date:
        return {}
    rows = db.query(MarketPrice).filter(MarketPrice.symbol.in_(symbols), MarketPrice.trading_date == latest_date).all()
    return {row.symbol: row.price for row in rows}


def _enrich_response(rec: WsRecommendation, current_price: Optional[float] = None) -> RecommendationResponse:
    perf = None
    if rec.entry_price and current_price and rec.entry_price > 0:
        perf = round(((current_price - rec.entry_price) / rec.entry_price) * 100, 2)
    return RecommendationResponse(
        id=str(rec.id),
        workspace_id=str(rec.workspace_id),
        broker_id=str(rec.broker_id),
        symbol=rec.symbol,
        side=rec.side,
        action_type=rec.action_type or rec.side,
        status=rec.status,
        entry_price=rec.entry_price,
        target_price=rec.target_price,
        cutloss_price=rec.cutloss_price,
        thesis=rec.thesis,
        risk_note=rec.risk_note,
        closed_reason=rec.closed_reason,
        applied_at=rec.applied_at,
        applied_portfolio_event_id=str(rec.applied_portfolio_event_id) if rec.applied_portfolio_event_id else None,
        parent_recommendation_id=str(rec.parent_recommendation_id) if rec.parent_recommendation_id else None,
        current_price=current_price,
        performance_pct=perf,
        published_at=rec.published_at,
        closed_at=rec.closed_at,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _get_or_create_workspace_portfolio(db: Session, workspace: BrokerWorkspace, broker_id: uuid.UUID) -> Portfolio:
    portfolio = (
        db.query(Portfolio)
        .options(joinedload(Portfolio.items))
        .filter(Portfolio.workspace_id == workspace.id)
        .first()
    )
    if portfolio:
        return portfolio
    portfolio = Portfolio(
        id=uuid.uuid4(),
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


@router.post("", response_model=RecommendationResponse)
def create_recommendation(
    data: RecommendationCreate,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)
    side = data.side.upper()
    action_type = (data.action_type or side).upper()
    if side not in {"BUY", "SELL"}:
        raise HTTPException(status_code=400, detail="side must be BUY or SELL")
    if action_type not in {"BUY", "SELL", "HOLD", "CLOSE", "REVERSE"}:
        raise HTTPException(status_code=400, detail="Unsupported action_type")

    rec = WsRecommendation(
        workspace_id=workspace.id,
        broker_id=profile.id,
        symbol=data.symbol.upper(),
        side=side,
        action_type=action_type,
        status="DRAFT",
        entry_price=data.entry_price,
        target_price=data.target_price,
        cutloss_price=data.cutloss_price,
        thesis=data.thesis,
        risk_note=data.risk_note,
    )
    db.add(rec)
    db.flush()
    _add_event(db, rec, "CREATED", profile.id, before="{}")
    db.commit()
    db.refresh(rec)
    prices = _latest_prices(db, [rec.symbol])
    return _enrich_response(rec, prices.get(rec.symbol))


@router.post("/{rec_id}/publish", response_model=RecommendationResponse)
def publish_recommendation(
    rec_id: uuid.UUID,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)
    rec = _get_broker_recommendation(db, workspace, rec_id)
    if rec.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Cannot publish a recommendation with status '{rec.status}'")

    before = _snapshot(rec)
    rec.status = "PUBLISHED"
    rec.published_at = datetime.now(timezone.utc)
    _add_event(db, rec, "PUBLISHED", profile.id, before)

    members = db.query(WorkspaceMembership).filter(
        WorkspaceMembership.workspace_id == workspace.id,
        WorkspaceMembership.status == "ACTIVE",
        WorkspaceMembership.profile_id != profile.id,
    ).all()
    for member in members:
        db.add(Notification(
            user_id=member.profile_id,
            type="RECOMMENDATION",
            title="Khuyến nghị mới",
            message=f"Broker vừa công bố khuyến nghị {rec.action_type} cho mã {rec.symbol}",
            link=str(rec.id),
        ))

    db.commit()
    db.refresh(rec)
    prices = _latest_prices(db, [rec.symbol])
    return _enrich_response(rec, prices.get(rec.symbol))


@router.patch("/{rec_id}/thesis", response_model=RecommendationResponse)
def update_thesis(
    rec_id: uuid.UUID,
    data: ThesisUpdate,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)
    rec = _get_broker_recommendation(db, workspace, rec_id)
    if rec.status not in {"DRAFT", "PUBLISHED", "PUBLISHED_ONLY", "APPLIED_TO_PORTFOLIO"}:
        raise HTTPException(status_code=400, detail="Cannot update a closed/archived recommendation")

    before = _snapshot(rec)
    event_type = "THESIS_UPDATED"
    if data.thesis is not None:
        rec.thesis = data.thesis
    if data.target_price is not None:
        rec.target_price = data.target_price
        event_type = "TARGET_UPDATED"
    if data.cutloss_price is not None:
        rec.cutloss_price = data.cutloss_price
        event_type = "CUTLOSS_UPDATED"
    if data.risk_note is not None:
        rec.risk_note = data.risk_note

    _add_event(db, rec, event_type, profile.id, before, note=data.note)
    db.commit()
    db.refresh(rec)
    prices = _latest_prices(db, [rec.symbol])
    return _enrich_response(rec, prices.get(rec.symbol))


@router.post("/{rec_id}/apply-to-portfolio", response_model=RecommendationResponse)
def apply_to_portfolio(
    rec_id: uuid.UUID,
    data: ApplyToPortfolioRequest,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)
    rec = _get_broker_recommendation(db, workspace, rec_id)
    if rec.status not in {"PUBLISHED", "PUBLISHED_ONLY", "APPLIED_TO_PORTFOLIO"}:
        raise HTTPException(status_code=400, detail="Only published recommendations can be applied")
    if data.weight < 0:
        raise HTTPException(status_code=400, detail="weight must be >= 0")

    portfolio = _get_or_create_workspace_portfolio(db, workspace, profile.id)
    before_portfolio = _portfolio_snapshot(portfolio)
    item = db.query(PortfolioItem).filter(
        PortfolioItem.portfolio_id == portfolio.id,
        PortfolioItem.symbol == rec.symbol,
    ).first()

    event_type = "REMOVED" if data.weight == 0 else "UPDATED"
    if data.weight == 0:
        if item:
            db.delete(item)
    elif item:
        item.weight = data.weight
        item.entry_price = data.applied_price or rec.entry_price or item.entry_price
        item.active_thesis = rec.thesis
        item.reason = rec.thesis
        item.source_recommendation_id = rec.id
    else:
        event_type = "ADDED"
        db.add(PortfolioItem(
            id=uuid.uuid4(),
            portfolio_id=portfolio.id,
            symbol=rec.symbol,
            weight=data.weight,
            entry_price=data.applied_price or rec.entry_price,
            active_thesis=rec.thesis,
            reason=rec.thesis,
            source_recommendation_id=rec.id,
        ))

    db.flush()
    db.refresh(portfolio)
    before_rec = _snapshot(rec)
    event = PortfolioEvent(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        recommendation_id=rec.id,
        event_type=event_type,
        before_state=before_portfolio,
        after_state=_portfolio_snapshot(portfolio),
        note=data.note,
        created_by=profile.id,
    )
    db.add(event)
    rec.status = "APPLIED_TO_PORTFOLIO"
    rec.applied_at = datetime.now(timezone.utc)
    rec.applied_portfolio_event_id = event.id
    _add_event(db, rec, "APPLIED_TO_PORTFOLIO", profile.id, before_rec, note=data.note)
    db.commit()
    db.refresh(rec)
    prices = _latest_prices(db, [rec.symbol])
    return _enrich_response(rec, prices.get(rec.symbol))


@router.post("/{rec_id}/close", response_model=RecommendationResponse)
def close_recommendation(
    rec_id: uuid.UUID,
    data: CloseRequest,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)
    rec = _get_broker_recommendation(db, workspace, rec_id)
    if rec.status in {"CLOSED", "ARCHIVED"}:
        raise HTTPException(status_code=400, detail="Recommendation is already closed")

    valid_reasons = {"TARGET_REACHED", "CUTLOSS_HIT", "MANUAL", "REVERSED_VIEW", "NO_LONGER_VALID"}
    reason = data.reason.upper()
    if reason not in valid_reasons:
        raise HTTPException(status_code=400, detail=f"Reason must be one of: {', '.join(sorted(valid_reasons))}")

    before = _snapshot(rec)
    rec.status = "CLOSED"
    rec.closed_reason = reason
    rec.closed_at = datetime.now(timezone.utc)
    _add_event(db, rec, "CLOSED", profile.id, before, note=data.note)
    db.commit()
    db.refresh(rec)
    prices = _latest_prices(db, [rec.symbol])
    return _enrich_response(rec, prices.get(rec.symbol))


@router.post("/{rec_id}/reverse", response_model=RecommendationResponse)
def reverse_recommendation(
    rec_id: uuid.UUID,
    data: ReverseRequest,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)
    rec = _get_broker_recommendation(db, workspace, rec_id)
    if rec.status in {"CLOSED", "ARCHIVED"}:
        raise HTTPException(status_code=400, detail="Recommendation is already closed")

    close_before = _snapshot(rec)
    rec.status = "CLOSED"
    rec.closed_reason = "REVERSED_VIEW"
    rec.closed_at = datetime.now(timezone.utc)
    _add_event(db, rec, "CLOSED", profile.id, close_before, note=data.close_note or "Đảo chiều quan điểm")

    new_side = "SELL" if rec.side == "BUY" else "BUY"
    new_rec = WsRecommendation(
        workspace_id=workspace.id,
        broker_id=profile.id,
        symbol=rec.symbol,
        side=new_side,
        action_type=new_side,
        status="DRAFT",
        entry_price=data.new_entry_price or data.close_price,
        target_price=data.target_price,
        cutloss_price=data.cutloss_price,
        thesis=data.thesis,
        risk_note=data.risk_note,
        parent_recommendation_id=rec.id,
    )
    db.add(new_rec)
    db.flush()
    _add_event(db, new_rec, "CREATED", profile.id, before="{}", note="Tạo từ flow đảo chiều")
    db.commit()
    db.refresh(new_rec)
    prices = _latest_prices(db, [new_rec.symbol])
    return _enrich_response(new_rec, prices.get(new_rec.symbol))


@router.post("/{rec_id}/archive", response_model=RecommendationResponse)
def archive_recommendation(
    rec_id: uuid.UUID,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)
    rec = _get_broker_recommendation(db, workspace, rec_id)
    if rec.status != "CLOSED":
        raise HTTPException(status_code=400, detail="Only closed recommendations can be archived")

    before = _snapshot(rec)
    rec.status = "ARCHIVED"
    _add_event(db, rec, "ARCHIVED", profile.id, before)
    db.commit()
    db.refresh(rec)
    prices = _latest_prices(db, [rec.symbol])
    return _enrich_response(rec, prices.get(rec.symbol))


@router.get("", response_model=List[RecommendationResponse])
def list_recommendations(
    status_filter: Optional[str] = None,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace_id = _get_viewer_workspace_id(db, profile)
    if not workspace_id:
        return []

    query = db.query(WsRecommendation).filter(WsRecommendation.workspace_id == workspace_id)
    if profile.role != "BROKER":
        query = query.filter(WsRecommendation.status.in_(["PUBLISHED", "PUBLISHED_ONLY", "APPLIED_TO_PORTFOLIO", "CLOSED", "ARCHIVED"]))
    if status_filter:
        normalized = status_filter.upper()
        if normalized == "ACTIVE":
            normalized = "PUBLISHED"
        query = query.filter(WsRecommendation.status == normalized)

    recs = query.order_by(WsRecommendation.created_at.desc()).all()
    prices = _latest_prices(db, list({rec.symbol for rec in recs}))
    return [_enrich_response(rec, prices.get(rec.symbol)) for rec in recs]


@router.get("/{rec_id}", response_model=RecommendationResponse)
def get_recommendation(
    rec_id: uuid.UUID,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace_id = _get_viewer_workspace_id(db, profile)
    if not workspace_id:
        raise HTTPException(status_code=403, detail="Not a member of any workspace")

    rec = db.query(WsRecommendation).filter(
        WsRecommendation.id == rec_id,
        WsRecommendation.workspace_id == workspace_id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if profile.role != "BROKER" and rec.status == "DRAFT":
        raise HTTPException(status_code=403, detail="Investors cannot view draft recommendations")
    prices = _latest_prices(db, [rec.symbol])
    return _enrich_response(rec, prices.get(rec.symbol))


@router.get("/{rec_id}/history", response_model=List[EventResponse])
def get_recommendation_history(
    rec_id: uuid.UUID,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace_id = _get_viewer_workspace_id(db, profile)
    if not workspace_id:
        raise HTTPException(status_code=403, detail="Not a member of any workspace")

    rec = db.query(WsRecommendation).filter(
        WsRecommendation.id == rec_id,
        WsRecommendation.workspace_id == workspace_id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if profile.role != "BROKER" and rec.status == "DRAFT":
        raise HTTPException(status_code=403, detail="Investors cannot view draft history")

    events = (
        db.query(RecommendationEvent)
        .filter(RecommendationEvent.recommendation_id == rec_id)
        .order_by(RecommendationEvent.created_at.asc())
        .all()
    )
    return [
        EventResponse(
            id=str(event.id),
            event_type=event.event_type,
            actor_id=str(event.actor_id),
            note=event.note,
            before_state=event.before_state,
            after_state=event.after_state,
            created_at=event.created_at,
        )
        for event in events
    ]
