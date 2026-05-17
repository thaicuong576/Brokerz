import json
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.schema import BrokerWorkspace, DashboardLayout, Profile, WorkspaceMembership
from src.modules.identity.service import get_or_create_profile
from src.shared.auth.dependencies import CurrentActor, get_current_actor


router = APIRouter(prefix="/api/v1/dashboard-layout", tags=["Dashboard Layout"])


DEFAULT_LAYOUT = [
    {"instanceId": "vnindex", "widgetId": "vnindex", "order": 0},
    {"instanceId": "liquidity", "widgetId": "liquidity", "order": 1},
    {"instanceId": "breadth", "widgetId": "breadth", "order": 2},
    {"instanceId": "foreignNet", "widgetId": "foreignNet", "order": 3},
]


class DashboardLayoutResponse(BaseModel):
    workspace_id: Optional[str] = None
    layout: List[dict[str, Any]]
    updated_at: Optional[datetime] = None


class DashboardLayoutUpdate(BaseModel):
    layout: List[dict[str, Any]]


def _viewer_workspace(db: Session, profile: Profile) -> Optional[BrokerWorkspace]:
    if profile.role == "BROKER":
        return db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
    membership = db.query(WorkspaceMembership).filter(
        WorkspaceMembership.profile_id == profile.id,
        WorkspaceMembership.status == "ACTIVE",
    ).first()
    if not membership:
        return None
    return db.query(BrokerWorkspace).filter(BrokerWorkspace.id == membership.workspace_id).first()


@router.get("", response_model=DashboardLayoutResponse)
def get_dashboard_layout(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    profile = get_or_create_profile(db, actor)
    workspace = _viewer_workspace(db, profile)
    if not workspace:
        return DashboardLayoutResponse(layout=DEFAULT_LAYOUT)
    saved = db.query(DashboardLayout).filter(DashboardLayout.workspace_id == workspace.id).first()
    if not saved:
        return DashboardLayoutResponse(workspace_id=str(workspace.id), layout=DEFAULT_LAYOUT)
    return DashboardLayoutResponse(
        workspace_id=str(workspace.id),
        layout=json.loads(saved.layout_json),
        updated_at=saved.updated_at,
    )


@router.put("", response_model=DashboardLayoutResponse)
def update_dashboard_layout(
    data: DashboardLayoutUpdate,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    if profile.role != "BROKER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only brokers can update dashboard layout")
    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broker workspace not set up")

    allowed = {"vnindex", "liquidity", "breadth", "foreignNet", "topImpact", "sectors", "foreignFlow"}
    normalized = []
    seen = set()
    for index, item in enumerate(data.layout):
        widget_id = item.get("widgetId")
        instance_id = item.get("instanceId") or widget_id
        if widget_id not in allowed or not instance_id or widget_id in seen:
            continue
        seen.add(widget_id)
        normalized.append({"instanceId": str(instance_id), "widgetId": widget_id, "order": index})

    if not normalized:
        normalized = DEFAULT_LAYOUT

    saved = db.query(DashboardLayout).filter(DashboardLayout.workspace_id == workspace.id).first()
    if not saved:
        saved = DashboardLayout(
            workspace_id=workspace.id,
            layout_json=json.dumps(normalized, ensure_ascii=False),
            updated_by=profile.id,
        )
        db.add(saved)
    else:
        saved.layout_json = json.dumps(normalized, ensure_ascii=False)
        saved.updated_by = profile.id

    db.commit()
    db.refresh(saved)
    return DashboardLayoutResponse(
        workspace_id=str(workspace.id),
        layout=json.loads(saved.layout_json),
        updated_at=saved.updated_at,
    )
