import uuid
from typing import Optional

from sqlalchemy.orm import Session

from src.models.schema import Profile
from src.shared.auth.dependencies import CurrentActor


def _normal_role(value: Optional[str]) -> str:
    role = (value or "INVESTOR").upper()
    return role if role in {"BROKER", "INVESTOR"} else "INVESTOR"


def _display_name(actor: CurrentActor) -> Optional[str]:
    metadata = actor.claims.user_metadata
    return metadata.get("full_name") or metadata.get("name")


def _avatar(actor: CurrentActor) -> Optional[str]:
    metadata = actor.claims.user_metadata
    return metadata.get("avatar_url") or metadata.get("picture")


def get_or_create_profile(db: Session, actor: CurrentActor) -> Profile:
    profile_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == profile_id).first()

    authoritative_role = actor.claims.app_metadata.get("role")
    role = _normal_role(authoritative_role)

    if not profile:
        profile = Profile(
            id=profile_id,
            email=actor.email,
            full_name=_display_name(actor) or actor.email or "User",
            avatar_url=_avatar(actor),
            role=role,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    changed = False
    if actor.email and profile.email != actor.email:
        profile.email = actor.email
        changed = True
    if not profile.full_name and _display_name(actor):
        profile.full_name = _display_name(actor)
        changed = True
    if not profile.avatar_url and _avatar(actor):
        profile.avatar_url = _avatar(actor)
        changed = True
    if authoritative_role and profile.role != role:
        profile.role = role
        changed = True

    if changed:
        db.commit()
        db.refresh(profile)

    return profile
