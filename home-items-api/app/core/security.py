"""보안 유틸: 비밀번호 해시와 JWT 토큰.

- 비밀번호: bcrypt 로 해시(평문 저장 금지)
- 토큰: JWT Access Token (jose)
"""

from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """평문 비밀번호를 bcrypt 해시로 변환."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """평문과 저장된 해시가 일치하는지 확인."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str | int, expires_minutes: int | None = None) -> str:
    """subject(보통 user id)를 담은 Access Token 발급."""
    minutes = (
        expires_minutes if expires_minutes is not None else settings.access_token_expire_minutes
    )
    expire = datetime.now(UTC) + timedelta(minutes=minutes)
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """토큰을 검증하고 subject(sub)를 돌려준다. 실패하면 None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    return payload.get("sub")
