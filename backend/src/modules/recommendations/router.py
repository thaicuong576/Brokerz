import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.schema import (
    BrokerWorkspace,
    MarketPrice,
    Notification,
    Profile,
    RecommendationEvent,
    WorkspaceMembership,
    WsRecommendation,
)
from src.modules.identity.service import get_or_create_profile
from src.shared.auth.dependencies import CurrentActor, get_current_actor
from sqlalchemy import func


router = APIRouter(prefix="/api/v1/recommendations", tags=["Recommendations"])


# --- Pydantic Schemas ---

class RecommendationCreate(BaseModel):
    symbol: str
    side: str  # BUY or SELL
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
    reason: str  # TARGET_REACHED, CUTLOSS_HIT, MANUAL
    note: Optional[str] = None


class RecommendationResponse(BaseModel):
    id: str
    workspace_id: str
    broker_id: str
    symbol: str
    side: str
    status: str
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    cutloss_price: Optional[float] = None
    thesis: Optional[str] = None
    risk_note: Optional[str] = None
    closed_reason: Optional[str] = None
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


# --- Helpers ---

def _get_broker_workspace(db: Session, profile: Profile) -> BrokerWorkspace:
    """Return the workspace owned by this broker, or raise 403."""
    if profile.role != "BROKER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only brokers can manage recommendations")
    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broker workspace not set up. Bootstrap first.")
    return workspace


def _get_viewer_workspace_id(db: Session, profile: Profile) -> Optional[uuid.UUID]:
    """Return workspace_id that the user can view (broker owns it, investor is member of it)."""
    if profile.role == "BROKER":
        ws = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
        return ws.id if ws else None
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.profile_id == profile.id, WorkspaceMembership.status == "ACTIVE")
        .first()
    )
    return membership.workspace_id if membership else None


def _snapshot(rec: WsRecommendation) -> str:
    """JSON snapshot of recommendation state for event logging."""
    return json.dumps({
        "status": rec.status,
        "thesis": rec.thesis,
        "target_price": rec.target_price,
        "cutloss_price": rec.cutloss_price,
        "risk_note": rec.risk_note,
        "entry_price": rec.entry_price,
    })


def _add_event(db: Session, rec: WsRecommendation, event_type: str, actor_id: uuid.UUID, before: str, note: Optional[str] = None):
    after = _snapshot(rec)
    db.add(RecommendationEvent(
        recommendation_id=rec.id,
        event_type=event_type,
        actor_id=actor_id,
        before_state=before,
        after_state=after,
        note=note,
    ))


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
        status=rec.status,
        entry_price=rec.entry_price,
        target_price=rec.target_price,
        cutloss_price=rec.cutloss_price,
        thesis=rec.thesis,
        risk_note=rec.risk_note,
        closed_reason=rec.closed_reason,
        current_price=current_price,
        performance_pct=perf,
        published_at=rec.published_at,
        closed_at=rec.closed_at,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _latest_prices(db: Session, symbols: list[str]) -> dict[str, float]:
    if not symbols:
        return {}
    latest_date = db.query(func.max(MarketPrice.trading_date)).scalar()
    if not latest_date:
        return {}
    rows = db.query(MarketPrice).filter(MarketPrice.symbol.in_(symbols), MarketPrice.trading_date == latest_date).all()
    return {r.symbol: r.price for r in rows}


# --- Endpoints ---

@router.post("", response_model=RecommendationResponse)
def create_recommendation(
    data: RecommendationCreate,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    """Create a new recommendation draft (broker only)."""
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)

    rec = WsRecommendation(
        workspace_id=workspace.id,
        broker_id=profile.id,
        symbol=data.symbol.upper(),
        side=data.side.upper(),
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
    """Publish a draft recommendation to investors."""
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)

    rec = db.query(WsRecommendation).filter(
        WsRecommendation.id == rec_id,
        WsRecommendation.workspace_id == workspace.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status not in ("DRAFT",):
        raise HTTPException(status_code=400, detail=f"Cannot publish a recommendation with status '{rec.status}'")

    before = _snapshot(rec)
    rec.status = "ACTIVE"
    rec.published_at = datetime.now(timezone.utc)
    _add_event(db, rec, "PUBLISHED", profile.id, before)

    # Notify workspace members
    members = db.query(WorkspaceMembership).filter(
        WorkspaceMembership.workspace_id == workspace.id,
        WorkspaceMembership.status == "ACTIVE",
        WorkspaceMembership.profile_id != profile.id,
    ).all()
    for m in members:
        db.add(Notification(
            user_id=m.profile_id,
            type="RECOMMENDATION",
            title="Khuyến nghị mới",
            message=f"Broker vừa công bố khuyến nghị {rec.side} cho mã {rec.symbol}",
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
    """Update thesis, target, cutloss, or risk note on an active recommendation."""
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)

    rec = db.query(WsRecommendation).filter(
        WsRecommendation.id == rec_id,
        WsRecommendation.workspace_id == workspace.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status not in ("DRAFT", "ACTIVE"):
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


@router.post("/{rec_id}/close", response_model=RecommendationResponse)
def close_recommendation(
    rec_id: uuid.UUID,
    data: CloseRequest,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    """Close a recommendation with a reason. Cannot undo."""
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)

    rec = db.query(WsRecommendation).filter(
        WsRecommendation.id == rec_id,
        WsRecommendation.workspace_id == workspace.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status in ("CLOSED", "ARCHIVED"):
        raise HTTPException(status_code=400, detail="Recommendation is already closed")

    valid_reasons = {"TARGET_REACHED", "CUTLOSS_HIT", "MANUAL"}
    if data.reason.upper() not in valid_reasons:
        raise HTTPException(status_code=400, detail=f"Reason must be one of: {', '.join(valid_reasons)}")

    before = _snapshot(rec)
    rec.status = "CLOSED"
    rec.closed_reason = data.reason.upper()
    rec.closed_at = datetime.now(timezone.utc)
    _add_event(db, rec, "CLOSED", profile.id, before, note=data.note)

    db.commit()
    db.refresh(rec)
    prices = _latest_prices(db, [rec.symbol])
    return _enrich_response(rec, prices.get(rec.symbol))


@router.post("/{rec_id}/archive", response_model=RecommendationResponse)
def archive_recommendation(
    rec_id: uuid.UUID,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    """Archive a closed recommendation from the active view."""
    profile = get_or_create_profile(db, actor)
    workspace = _get_broker_workspace(db, profile)

    rec = db.query(WsRecommendation).filter(
        WsRecommendation.id == rec_id,
        WsRecommendation.workspace_id == workspace.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
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
    """List recommendations in the user's workspace.
    
    Brokers see all their own.
    Investors see only ACTIVE/CLOSED/ARCHIVED (not DRAFT).
    Optional ?status_filter=ACTIVE or ?status_filter=CLOSED
    """
    profile = get_or_create_profile(db, actor)
    workspace_id = _get_viewer_workspace_id(db, profile)
    if not workspace_id:
        return []

    query = db.query(WsRecommendation).filter(WsRecommendation.workspace_id == workspace_id)

    if profile.role != "BROKER":
        query = query.filter(WsRecommendation.status.in_(["ACTIVE", "CLOSED", "ARCHIVED"]))

    if status_filter:
        query = query.filter(WsRecommendation.status == status_filter.upper())

    recs = query.order_by(WsRecommendation.created_at.desc()).all()

    symbols = list({r.symbol for r in recs})
    prices = _latest_prices(db, symbols)

    return [_enrich_response(r, prices.get(r.symbol)) for r in recs]


@router.get("/{rec_id}", response_model=RecommendationResponse)
def get_recommendation(
    rec_id: uuid.UUID,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    """Get a single recommendation detail."""
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
    """Get the immutable event history for a recommendation."""
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

    events = (
        db.query(RecommendationEvent)
        .filter(RecommendationEvent.recommendation_id == rec_id)
        .order_by(RecommendationEvent.created_at.asc())
        .all()
    )
    return [
        EventResponse(
            id=str(e.id),
            event_type=e.event_type,
            actor_id=str(e.actor_id),
            note=e.note,
            before_state=e.before_state,
            after_state=e.after_state,
            created_at=e.created_at,
        )
        for e in events
    ]
