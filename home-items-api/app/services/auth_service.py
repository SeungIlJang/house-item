"""인증 업무 로직."""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, db: Session) -> None:
        self.users = UserRepository(db)

    def signup(self, *, email: str, password: str, name: str) -> User:
        if self.users.get_by_email(email) is not None:
            raise ConflictError("이미 사용 중인 이메일입니다.", error_code="EMAIL_ALREADY_EXISTS")
        return self.users.create(
            email=email,
            password_hash=hash_password(password),
            name=name,
        )

    def login(self, *, email: str, password: str) -> tuple[str, User]:
        user = self.users.get_by_email(email)
        # 이메일 존재 여부를 노출하지 않도록 동일한 오류 메시지를 사용
        if user is None or not verify_password(password, user.password_hash):
            raise UnauthorizedError(
                "이메일 또는 비밀번호가 올바르지 않습니다.",
                error_code="INVALID_CREDENTIALS",
            )
        token = create_access_token(user.id)
        return token, user
