import uuid
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.api.schemas import ManualOverrideRequest
from src.database import get_db
from src.models import DailyReportInput, ForeignTrading as ReportForeignTrading, MarketBreadth, MarketIndex, SectorPerformance
from src.models.schema import (
    BrokerWorkspace,
    DailyBrief,
    ForeignTrading,
    IndexSnapshot,
    Profile,
    WorkspaceMembership,
)
from src.modules.identity.service import get_or_create_profile
from src.services.ai_engine import AIEngine
from src.shared.auth.dependencies import CurrentActor, get_current_actor

router = APIRouter(prefix="/api/v1/daily-briefs", tags=["Daily Briefs"])


class DraftDailyBriefRequest(BaseModel):
    manual_override: Optional[ManualOverrideRequest] = None
    title: Optional[str] = None


class UpdateDailyBriefRequest(BaseModel):
    title: Optional[str] = None
    content_markdown: Optional[str] = None


class DailyBriefResponse(BaseModel):
    id: str
    workspace_id: str
    broker_id: str
    broker_name: Optional[str] = None
    title: str
    content_markdown: str
    status: str
    market_date: str
    published_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


def _require_broker_workspace(db: Session, profile: Profile) -> BrokerWorkspace:
    if profile.role != "BROKER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only broker profiles can manage daily briefs")
    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broker workspace has not been created")
    return workspace


def _viewer_workspace_id(db: Session, profile: Profile) -> uuid.UUID:
    if profile.role == "BROKER":
        workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
        if workspace:
            return workspace.id

    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.profile_id == profile.id, WorkspaceMembership.status == "ACTIVE")
        .order_by(WorkspaceMembership.joined_at.asc())
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workspace membership is required")
    return membership.workspace_id


def _brief_response(brief: DailyBrief, warnings: Optional[List[str]] = None) -> DailyBriefResponse:
    return DailyBriefResponse(
        id=str(brief.id),
        workspace_id=str(brief.workspace_id),
        broker_id=str(brief.broker_id),
        broker_name=brief.broker.full_name if brief.broker else None,
        title=brief.title,
        content_markdown=brief.content_markdown,
        status=brief.status,
        market_date=brief.market_date.isoformat(),
        published_at=brief.published_at.isoformat() if brief.published_at else None,
        created_at=brief.created_at.isoformat() if brief.created_at else None,
        updated_at=brief.updated_at.isoformat() if brief.updated_at else None,
        warnings=warnings or [],
    )


def _safe_execute(db: Session, sql: str, params: Optional[dict] = None, warnings: Optional[List[str]] = None, label: str = "market data"):
    try:
        return db.execute(text(sql), params or {}).fetchall()
    except Exception:
        if warnings is not None:
            warnings.append(f"Không tải được {label}; bản nháp vẫn được tạo từ dữ liệu còn lại.")
        return []


def _safe_scalar(db: Session, sql: str, warnings: Optional[List[str]] = None, label: str = "market data"):
    try:
        return db.execute(text(sql)).scalar()
    except Exception:
        if warnings is not None:
            warnings.append(f"Không tải được {label}; bản nháp vẫn được tạo từ dữ liệu còn lại.")
        return None


def _generate_market_report(db: Session, manual_override: Optional[ManualOverrideRequest]) -> Tuple[str, date, List[str]]:
    warnings: List[str] = []
    index_snapshot = (
        db.query(IndexSnapshot)
        .filter(
            IndexSnapshot.symbol == "VNINDEX",
            ((IndexSnapshot.total_volume.isnot(None)) & (IndexSnapshot.total_volume > 0))
            | ((IndexSnapshot.total_value.isnot(None)) & (IndexSnapshot.total_value > 0)),
        )
        .order_by(IndexSnapshot.trading_date.desc())
        .first()
    ) or (
        db.query(IndexSnapshot)
        .filter(IndexSnapshot.symbol == "VNINDEX")
        .order_by(IndexSnapshot.trading_date.desc())
        .first()
    )
    if not index_snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có dữ liệu VNINDEX để tạo nhận định.")

    pos_rows = _safe_execute(
        db,
        "SELECT * FROM impact_metrics WHERE trading_date = :d AND impact_value > 0 ORDER BY impact_value DESC LIMIT 5",
        {"d": index_snapshot.trading_date},
        warnings,
        "top tác động tăng",
    )
    neg_rows = _safe_execute(
        db,
        "SELECT * FROM impact_metrics WHERE trading_date = :d AND impact_value < 0 ORDER BY impact_value ASC LIMIT 5",
        {"d": index_snapshot.trading_date},
        warnings,
        "top tác động giảm",
    )
    sector_rows = _safe_execute(
        db,
        "SELECT * FROM sector_performance_metrics WHERE trading_date = :d ORDER BY avg_change DESC",
        {"d": index_snapshot.trading_date},
        warnings,
        "diễn biến nhóm ngành",
    )
    foreign_date = _safe_scalar(db, "SELECT MAX(trading_date) FROM foreign_trading", warnings, "giao dịch khối ngoại")
    foreign_rows = []
    if foreign_date:
        foreign_rows = (
            db.query(ForeignTrading)
            .filter(ForeignTrading.trading_date == foreign_date)
            .order_by(ForeignTrading.net_val.desc())
            .all()
        )

    if not pos_rows and not neg_rows:
        warnings.append("Thiếu dữ liệu top tác động VN-Index.")
    if not sector_rows:
        warnings.append("Thiếu dữ liệu nhóm ngành.")
    if not foreign_rows:
        warnings.append("Thiếu dữ liệu mua/bán khối ngoại.")

    foreign_net = sum(float(row.net_val or 0) for row in foreign_rows)
    foreign_status = "TRUNG TÍNH"
    if foreign_net > 0:
        foreign_status = "MUA RÒNG"
    elif foreign_net < 0:
        foreign_status = "BÁN RÒNG"

    liquidity_comment = "Thanh khoản ở mức trung bình"
    technical_score = 5
    technical_rating = "Tích cực"
    pe_ratio = 14.5
    expert_comment = "Thị trường phân hóa, cần theo dõi thêm tín hiệu dòng tiền."
    if manual_override:
        if manual_override.pe_ratio is not None:
            pe_ratio = manual_override.pe_ratio
        if manual_override.technical_score is not None:
            technical_score = manual_override.technical_score
            if technical_score >= 4:
                technical_rating = "Tích cực"
            elif technical_score <= -4:
                technical_rating = "Tiêu cực"
            else:
                technical_rating = "Trung tính"
        if manual_override.technical_rating is not None:
            technical_rating = manual_override.technical_rating
        if manual_override.expert_comment is not None:
            expert_comment = manual_override.expert_comment
        if manual_override.liquidity_comment is not None:
            liquidity_comment = manual_override.liquidity_comment

    sectors_data: List[SectorPerformance] = []
    for row in sector_rows:
        symbols = [s.strip() for s in (getattr(row, "top_symbols", "") or "").split(",") if s.strip()]
        avg_change = float(row.avg_change or 0)
        sectors_data.append(
            SectorPerformance(
                name=row.sector,
                avg_change=avg_change,
                top_gainers=symbols if avg_change >= 0 else [],
                top_losers=symbols if avg_change < 0 else [],
                status="Tích cực" if avg_change > 0 else "Tiêu cực" if avg_change < 0 else "Phân hóa",
            )
        )

    report_input = DailyReportInput(
        date=index_snapshot.trading_date.strftime("%d/%m/%Y"),
        index=MarketIndex(
            symbol=index_snapshot.symbol,
            point=float(index_snapshot.point or 0),
            change_point=float(index_snapshot.change_point or 0),
            change_percent=float(index_snapshot.change_percent or 0),
            total_volume=int(index_snapshot.total_volume or 0),
            total_value=float(index_snapshot.total_value or 0),
            breadth=MarketBreadth(
                green=int(index_snapshot.breadth_green or 0),
                red=int(index_snapshot.breadth_red or 0),
                yellow=int(index_snapshot.breadth_yellow or 0),
                ceiling=int(index_snapshot.breadth_ceiling or 0),
                floor=int(index_snapshot.breadth_floor or 0),
            ),
        ),
        liquidity_comment=liquidity_comment,
        impact_positive=[f"{row.symbol} ({float(row.change_percent or 0):+.2f}%)" for row in pos_rows],
        impact_negative=[f"{row.symbol} ({float(row.change_percent or 0):+.2f}%)" for row in neg_rows],
        sectors=sectors_data,
        foreign=ReportForeignTrading(
            net_value=round(abs(foreign_net) / 1_000_000_000),
            status=foreign_status,
            top_buy=[
                f"{row.symbol} (+{float(row.net_val or 0) / 1_000_000_000:,.0f} tỷ đồng)"
                for row in sorted(foreign_rows, key=lambda r: float(r.net_val or 0), reverse=True)[:3]
            ],
            top_sell=[
                f"{row.symbol} ({float(row.net_val or 0) / 1_000_000_000:,.0f} tỷ đồng)"
                for row in sorted(foreign_rows, key=lambda r: float(r.net_val or 0))[:3]
            ],
        ),
        technical_score=technical_score,
        technical_rating=technical_rating,
        pe_ratio=pe_ratio,
        expert_comment=expert_comment,
    )

    content = AIEngine().generate_report(report_input)
    if not content or content.strip().lower().startswith(("lỗi", "loi", "error")):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=content or "AI không tạo được nhận định thị trường")
    return content, index_snapshot.trading_date, warnings


def _get_owned_brief(db: Session, brief_id: uuid.UUID, workspace: BrokerWorkspace) -> DailyBrief:
    brief = db.query(DailyBrief).filter(DailyBrief.id == brief_id, DailyBrief.workspace_id == workspace.id).first()
    if not brief:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily brief not found")
    return brief


@router.post("/draft-from-market", response_model=DailyBriefResponse)
def draft_from_market(
    payload: DraftDailyBriefRequest,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _require_broker_workspace(db, profile)
    content, market_date, warnings = _generate_market_report(db, payload.manual_override)
    title = payload.title or f"Nhận định thị trường ngày {market_date.strftime('%d/%m/%Y')}"

    brief = DailyBrief(
        workspace_id=workspace.id,
        broker_id=profile.id,
        title=title,
        content_markdown=content,
        status="DRAFT",
        market_date=market_date,
    )
    db.add(brief)
    db.commit()
    db.refresh(brief)
    return _brief_response(brief, warnings)


@router.patch("/{brief_id}", response_model=DailyBriefResponse)
def update_brief(
    brief_id: uuid.UUID,
    payload: UpdateDailyBriefRequest,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _require_broker_workspace(db, profile)
    brief = _get_owned_brief(db, brief_id, workspace)
    if brief.status != "DRAFT":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft briefs can be edited in v1")
    if payload.title is not None:
        brief.title = payload.title.strip() or brief.title
    if payload.content_markdown is not None:
        brief.content_markdown = payload.content_markdown.strip()
    db.commit()
    db.refresh(brief)
    return _brief_response(brief)


@router.post("/{brief_id}/publish", response_model=DailyBriefResponse)
def publish_brief(
    brief_id: uuid.UUID,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    workspace = _require_broker_workspace(db, profile)
    brief = _get_owned_brief(db, brief_id, workspace)
    if brief.status == "ARCHIVED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archived briefs cannot be published")

    (
        db.query(DailyBrief)
        .filter(
            DailyBrief.workspace_id == workspace.id,
            DailyBrief.status == "PUBLISHED",
            DailyBrief.id != brief.id,
        )
        .update({DailyBrief.status: "ARCHIVED"}, synchronize_session=False)
    )
    brief.status = "PUBLISHED"
    brief.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(brief)
    return _brief_response(brief)


@router.get("/latest", response_model=Optional[DailyBriefResponse])
def get_latest_brief(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    profile = get_or_create_profile(db, actor)
    workspace_id = _viewer_workspace_id(db, profile)
    brief = (
        db.query(DailyBrief)
        .filter(DailyBrief.workspace_id == workspace_id, DailyBrief.status == "PUBLISHED")
        .order_by(DailyBrief.published_at.desc(), DailyBrief.created_at.desc())
        .first()
    )
    return _brief_response(brief) if brief else None


@router.get("", response_model=List[DailyBriefResponse])
def list_briefs(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    profile = get_or_create_profile(db, actor)
    workspace_id = _viewer_workspace_id(db, profile)
    query = db.query(DailyBrief).filter(DailyBrief.workspace_id == workspace_id)
    if profile.role != "BROKER":
        query = query.filter(DailyBrief.status == "PUBLISHED")
    briefs = query.order_by(DailyBrief.created_at.desc()).limit(30).all()
    return [_brief_response(brief) for brief in briefs]
