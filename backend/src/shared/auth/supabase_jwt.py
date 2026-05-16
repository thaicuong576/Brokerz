import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests
from fastapi import HTTPException, status


@dataclass(frozen=True)
class SupabaseClaims:
    sub: str
    email: Optional[str]
    aud: Any
    app_metadata: Dict[str, Any]
    user_metadata: Dict[str, Any]
    raw: Dict[str, Any]


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _decode_json(value: str) -> Dict[str, Any]:
    return json.loads(_b64url_decode(value).decode("utf-8"))


def _verify_hs256(token: str, secret: str) -> Dict[str, Any]:
    try:
        header_raw, payload_raw, signature_raw = token.split(".")
        header = _decode_json(header_raw)
        payload = _decode_json(payload_raw)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase token format",
        ) from exc

    if header.get("alg") != "HS256":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unsupported Supabase token algorithm",
        )

    signed = f"{header_raw}.{payload_raw}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).digest()
    actual = _b64url_decode(signature_raw)
    if not hmac.compare_digest(expected, actual):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase token signature",
        )

    now = int(time.time())
    if payload.get("exp") and int(payload["exp"]) < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase token expired")
    if payload.get("nbf") and int(payload["nbf"]) > now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase token not active")

    expected_aud = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    aud = payload.get("aud")
    if expected_aud:
        valid_aud = expected_aud in aud if isinstance(aud, list) else aud == expected_aud
        if not valid_aud:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token audience")

    expected_issuer = os.getenv("SUPABASE_JWT_ISSUER")
    if expected_issuer and payload.get("iss") != expected_issuer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token issuer")

    return payload


def _verify_with_supabase_api(token: str) -> Dict[str, Any]:
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ROLE_KEY")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    api_key = service_key or anon_key
    if not supabase_url or not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth verification is not configured. Set SUPABASE_JWT_SECRET or SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY.",
        )

    try:
        response = requests.get(
            f"{supabase_url.rstrip('/')}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": api_key},
            timeout=8,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach Supabase auth service",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")

    data = response.json()
    return {
        "sub": data.get("id"),
        "email": data.get("email"),
        "aud": data.get("aud"),
        "app_metadata": data.get("app_metadata") or {},
        "user_metadata": data.get("user_metadata") or {},
    }


def verify_supabase_token(token: str) -> SupabaseClaims:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    payload = _verify_hs256(token, secret) if secret else _verify_with_supabase_api(token)

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
