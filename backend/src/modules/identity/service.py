import os
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from src.models.schema import Profile
from src.shared.auth.dependencies import CurrentActor


def _normal_role(value: Optional[str]) -> str:
    role = (value or "INVESTOR").upper()
    return role if role in {"BROKER", "INVESTOR"} else "INVESTOR"


def _is_allowlisted_broker(email: Optional[str]) -> bool:
    """Check if email is in the BROKER_EMAIL_ALLOWLIST env var (comma-separated).

    This is the MVP-safe way to grant BROKER role without needing Supabase
    app_metadata to be set in the dashboard.  Trust hierarchy:
      1. BROKER_EMAIL_ALLOWLIST (env) — highest trust, operator-controlled
      2. app_metadata.role=BROKER in Supabase JWT — trusted if JWT secret is set
      3. default: INVESTOR
    """
    if not email:
        return False
    raw = os.getenv("BROKER_EMAIL_ALLOWLIST", "")
    allowed = {e.strip().lower() for e in raw.split(",") if e.strip()}
    return email.lower() in allowed


def _resolve_role(actor: CurrentActor) -> str:
    """Resolve the authoritative role for this actor."""
    if _is_allowlisted_broker(actor.email):
        return "BROKER"
    metadata_role = actor.claims.app_metadata.get("role")
    return _normal_role(metadata_role)


def _display_name(actor: CurrentActor) -> Optional[str]:
    metadata = actor.claims.user_metadata
    return metadata.get("full_name") or metadata.get("name")


def _avatar(actor: CurrentActor) -> Optional[str]:
    metadata = actor.claims.user_metadata
    return metadata.get("avatar_url") or metadata.get("picture")


def get_or_create_profile(db: Session, actor: CurrentActor) -> Profile:
    profile_id = uuid.UUID(actor.id)
    profile = db.query(Profile).filter(Profile.id == profile_id).first()

    role = _resolve_role(actor)

    if not profile:
        # Prevent UniqueViolation if the user re-registered with the same email
        if actor.email:
            existing = db.query(Profile).filter(Profile.email == actor.email).first()
            if existing:
                db.delete(existing)
                db.commit()

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
    # Always re-evaluate the role on each login so allowlist changes take effect
    if profile.role != role:
        profile.role = role
        changed = True

    if changed:
        db.commit()
        db.refresh(profile)

    return profile
