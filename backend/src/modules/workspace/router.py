import random
import string
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.schema import BrokerWorkspace, Profile, SoulKeyInvite, WorkspaceMembership
from src.modules.identity.service import get_or_create_profile
from src.shared.auth.dependencies import CurrentActor, get_current_actor

router = APIRouter(prefix="/api/v1/workspaces", tags=["Workspaces"])


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    owner_profile_id: str
    role: str
    invite_code: Optional[str] = None


class CurrentWorkspaceResponse(BaseModel):
    profile_role: str
    workspace: Optional[WorkspaceResponse] = None


class BootstrapBrokerRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class InviteVerifyRequest(BaseModel):
    code: str


class InviteVerifyResponse(BaseModel):
    valid: bool
    workspace_name: Optional[str] = None
    broker_name: Optional[str] = None
    reason: Optional[str] = None


class InviteRedeemResponse(BaseModel):
    status: str
    workspace: WorkspaceResponse


def _generate_soulkey() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return f"BKZ-{''.join(random.choices(alphabet, k=4))}-{''.join(random.choices(alphabet, k=4))}"


def _active_owner_invite(db: Session, workspace_id: uuid.UUID) -> Optional[SoulKeyInvite]:
    return (
        db.query(SoulKeyInvite)
        .filter(SoulKeyInvite.workspace_id == workspace_id, SoulKeyInvite.status == "ACTIVE")
        .order_by(SoulKeyInvite.created_at.asc())
        .first()
    )


def _workspace_response(db: Session, workspace: BrokerWorkspace, profile_id: uuid.UUID, role: str) -> WorkspaceResponse:
    invite = _active_owner_invite(db, workspace.id)
    return WorkspaceResponse(
        id=str(workspace.id),
        name=workspace.name,
        owner_profile_id=str(workspace.owner_profile_id),
        role=role,
        invite_code=invite.code if role == "OWNER" and invite else None,
    )


def _current_workspace_for_profile(db: Session, profile: Profile) -> Optional[WorkspaceResponse]:
    if profile.role == "BROKER":
        workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
        if workspace:
            return _workspace_response(db, workspace, profile.id, "OWNER")

    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.profile_id == profile.id, WorkspaceMembership.status == "ACTIVE")
        .order_by(WorkspaceMembership.joined_at.asc())
        .first()
    )
    if not membership:
        return None
    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.id == membership.workspace_id).first()
    if not workspace:
        return None
    return _workspace_response(db, workspace, profile.id, membership.role)


@router.get("/current", response_model=CurrentWorkspaceResponse)
def get_current_workspace(actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    profile = get_or_create_profile(db, actor)
    return CurrentWorkspaceResponse(
        profile_role=profile.role,
        workspace=_current_workspace_for_profile(db, profile),
    )


@router.post("/bootstrap-broker", response_model=WorkspaceResponse)
def bootstrap_broker(
    payload: BootstrapBrokerRequest,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    if profile.role != "BROKER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only broker profiles can bootstrap a workspace")

    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == profile.id).first()
    if not workspace:
        workspace = BrokerWorkspace(
            owner_profile_id=profile.id,
            name=payload.name or f"{profile.full_name or 'Broker'} Workspace",
            description=payload.description,
        )
        db.add(workspace)
        db.flush()

        db.add(WorkspaceMembership(workspace_id=workspace.id, profile_id=profile.id, role="OWNER", status="ACTIVE"))

    invite = _active_owner_invite(db, workspace.id)
    if not invite:
        code = _generate_soulkey()
        while db.query(SoulKeyInvite).filter(SoulKeyInvite.code == code).first():
            code = _generate_soulkey()
        invite = SoulKeyInvite(
            workspace_id=workspace.id,
            code=code,
            label="Default VIP access",
            status="ACTIVE",
            created_by=profile.id,
        )
        profile.soul_key = code
        db.add(invite)

    db.commit()
    db.refresh(workspace)
    return _workspace_response(db, workspace, profile.id, "OWNER")


@router.post("/invites/verify", response_model=InviteVerifyResponse)
def verify_invite(payload: InviteVerifyRequest, db: Session = Depends(get_db)):
    code = payload.code.strip().upper()
    invite = db.query(SoulKeyInvite).filter(SoulKeyInvite.code == code).first()
    if not invite:
        return InviteVerifyResponse(valid=False, reason="SoulKey not found")
    if invite.status != "ACTIVE":
        return InviteVerifyResponse(valid=False, reason="SoulKey has been revoked")
    if invite.max_redemptions is not None and invite.redemption_count >= invite.max_redemptions:
        return InviteVerifyResponse(valid=False, reason="SoulKey redemption limit reached")

    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.id == invite.workspace_id).first()
    owner = db.query(Profile).filter(Profile.id == workspace.owner_profile_id).first() if workspace else None
    return InviteVerifyResponse(
        valid=True,
        workspace_name=workspace.name if workspace else None,
        broker_name=owner.full_name if owner else None,
    )


@router.post("/invites/redeem", response_model=InviteRedeemResponse)
def redeem_invite(
    payload: InviteVerifyRequest,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    code = payload.code.strip().upper()
    invite = db.query(SoulKeyInvite).filter(SoulKeyInvite.code == code).first()
    if not invite or invite.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or revoked SoulKey")
    if invite.max_redemptions is not None and invite.redemption_count >= invite.max_redemptions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SoulKey redemption limit reached")

    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.id == invite.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SoulKey workspace is unavailable")
    if workspace.owner_profile_id == profile.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace owner already has access")

    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.workspace_id == workspace.id, WorkspaceMembership.profile_id == profile.id)
        .first()
    )
    if membership:
        membership.status = "ACTIVE"
    else:
        db.add(WorkspaceMembership(workspace_id=workspace.id, profile_id=profile.id, role="MEMBER", status="ACTIVE"))
        invite.redemption_count += 1

    profile.linked_broker_id = workspace.owner_profile_id
    db.commit()
    db.refresh(workspace)

    return InviteRedeemResponse(status="success", workspace=_workspace_response(db, workspace, profile.id, "MEMBER"))


@router.post("/invites/{invite_id}/revoke")
def revoke_invite(
    invite_id: uuid.UUID,
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    invite = db.query(SoulKeyInvite).filter(SoulKeyInvite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SoulKey invite not found")
    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.id == invite.workspace_id).first()
    if not workspace or workspace.owner_profile_id != profile.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the broker owner can revoke this SoulKey")

    invite.status = "REVOKED"
    invite.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "success"}


@router.post("/current/leave")
def leave_current_workspace(
    actor: CurrentActor = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, actor)
    if profile.role == "BROKER":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broker owner cannot leave their own workspace")

    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.profile_id == profile.id, WorkspaceMembership.status == "ACTIVE")
        .order_by(WorkspaceMembership.joined_at.asc())
        .first()
    )
    if not membership:
        return {"status": "success"}

    membership.status = "REVOKED"
    another_active_membership = (
        db.query(WorkspaceMembership)
        .filter(
            WorkspaceMembership.profile_id == profile.id,
            WorkspaceMembership.status == "ACTIVE",
            WorkspaceMembership.id != membership.id,
        )
        .first()
    )
    if not another_active_membership:
        profile.linked_broker_id = None

    db.commit()
    return {"status": "success"}
