import os
import time
import logging
import jwt
import requests
from dataclasses import dataclass
from typing import Any, Dict, Optional, List
from fastapi import HTTPException, status
from jwt.exceptions import PyJWTError, ExpiredSignatureError

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class SupabaseClaims:
    sub: str
    email: Optional[str]
    aud: Any
    app_metadata: Dict[str, Any]
    user_metadata: Dict[str, Any]
    raw: Dict[str, Any]

class JWKSCache:
    """Caches public keys from Supabase to avoid hitting the network on every request."""
    _keys: Dict[str, Any] = {}
    _last_fetch: float = 0
    _ttl: int = 3600 # 1 hour

    @classmethod
    def get_public_key(cls, kid: str) -> Optional[Any]:
        now = time.time()
        if kid not in cls._keys or (now - cls._last_fetch) > cls._ttl:
            cls._fetch_keys()
        return cls._keys.get(kid)

    @classmethod
    def _fetch_keys(cls):
        supabase_url = os.getenv("SUPABASE_URL")
        if not supabase_url:
            return
        
        try:
            # Supabase JWKS endpoint
            url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                jwks = response.json()
                for key_data in jwks.get("keys", []):
                    kid = key_data.get("kid")
                    if kid:
                        # Convert JWK to PEM format using PyJWT's helper
                        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data) if key_data.get("kty") == "RSA" else \
                                     jwt.algorithms.ECAlgorithm.from_jwk(key_data)
                        cls._keys[kid] = public_key
                cls._last_fetch = time.time()
                logger.info(f"Successfully refreshed {len(cls._keys)} JWKS keys from Supabase.")
        except Exception as e:
            logger.error(f"Failed to fetch JWKS from Supabase: {e}")

def verify_supabase_token(token: str) -> SupabaseClaims:
    """
    Verifies a Supabase JWT token using:
    1. Local HS256 secret (if configured)
    2. Local ES256/RS256 public keys (fetched via JWKS)
    3. Fallback to Supabase /user API (if local verification fails)
    """
    secret = os.getenv("SUPABASE_JWT_SECRET")
    audience = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    
    # 1. Attempt Local Verification
    try:
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg")
        kid = unverified_header.get("kid")

        # Case A: HS256 with provided secret
        if alg == "HS256" and secret:
            payload = jwt.decode(token, secret, algorithms=["HS256"], audience=audience)
            return _create_claims(payload)

        # Case B: Asymmetric Key (ES256/RS256) via JWKS
        if kid:
            public_key = JWKSCache.get_public_key(kid)
            if public_key:
                payload = jwt.decode(token, public_key, algorithms=[alg], audience=audience)
                return _create_claims(payload)

    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase token expired")
    except PyJWTError as e:
        # If local verification fails, we don't give up yet! 
        # We fallback to the Supabase API verification which is the source of truth.
        logger.warning(f"Local JWT verification failed ({type(e).__name__}): {e}. Falling back to Supabase API.")
    except Exception as e:
        logger.error(f"Unexpected error during JWT verification: {e}")

    # 2. Fallback to Supabase API Verification
    return _verify_with_supabase_api(token)

def _verify_with_supabase_api(token: str) -> SupabaseClaims:
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    api_key = service_key or anon_key
    
    if not supabase_url or not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth verification is not configured.",
        )

    try:
        response = requests.get(
            f"{supabase_url.rstrip('/')}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": api_key},
            timeout=8,
        )
        if response.status_code == 200:
            data = response.json()
            payload = {
                "sub": data.get("id"),
                "email": data.get("email"),
                "aud": data.get("aud"),
                "app_metadata": data.get("app_metadata") or {},
                "user_metadata": data.get("user_metadata") or {},
            }
            return _create_claims(payload)
    except Exception as e:
        logger.error(f"Supabase API verification failed: {e}")

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")

def _create_claims(payload: Dict[str, Any]) -> SupabaseClaims:
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase token missing subject")
    
    return SupabaseClaims(
        sub=subject,
        email=payload.get("email"),
        aud=payload.get("aud"),
        app_metadata=payload.get("app_metadata") or {},
        user_metadata=payload.get("user_metadata") or {},
        raw=payload,
    )
