"""인증 업무 로직."""

from sqlalchemy.orm import Session

from app.core.defaults import (
    DEFAULT_CATEGORIES,
    DEFAULT_HOME_NAME,
    DEFAULT_ROOMS,
    DEFAULT_TAGS,
)
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.category import Category
from app.models.home import Home
from app.models.room import Room
from app.models.tag import Tag
from app.models.user import User
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def signup(self, *, email: str, password: str, name: str) -> User:
        if self.users.get_by_email(email) is not None:
            raise ConflictError("이미 사용 중인 이메일입니다.", error_code="EMAIL_ALREADY_EXISTS")
        user = self.users.create(
            email=email,
            password_hash=hash_password(password),
            name=name,
        )
        self._seed_defaults(user.id)
        return user

    def _seed_defaults(self, user_id: int) -> None:
        """신규 사용자에게 기본 집/장소/카테고리/태그를 넣어준다."""
        home = Home(user_id=user_id, name=DEFAULT_HOME_NAME)
        self.db.add(home)
        self.db.flush()  # home.id 확보
        self.db.add_all(
            Room(home_id=home.id, name=name, sort_order=index)
            for index, name in enumerate(DEFAULT_ROOMS)
        )
        self.db.add_all(Category(user_id=user_id, name=name) for name in DEFAULT_CATEGORIES)
        self.db.add_all(Tag(user_id=user_id, name=name) for name in DEFAULT_TAGS)
        self.db.commit()

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
