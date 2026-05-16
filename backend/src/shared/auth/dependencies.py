from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.shared.auth.supabase_jwt import SupabaseClaims, verify_supabase_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentActor:
    id: str
    email: Optional[str]
    claims: SupabaseClaims


def get_current_actor(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentActor:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    claims = verify_supabase_token(credentials.credentials)
    return CurrentActor(id=claims.sub, email=claims.email, claims=claims)
