"""공통 의존성: DB 세션, 현재 사용자."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository

# Swagger UI 에서 Bearer 토큰 입력을 지원
_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise UnauthorizedError("인증이 필요합니다.", error_code="NOT_AUTHENTICATED")

    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise UnauthorizedError("유효하지 않은 토큰입니다.", error_code="INVALID_TOKEN")

    user = UserRepository(db).get_by_id(int(subject))
    if user is None:
        raise UnauthorizedError("사용자를 찾을 수 없습니다.", error_code="USER_NOT_FOUND")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
