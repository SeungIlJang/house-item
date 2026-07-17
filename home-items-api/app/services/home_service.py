"""집(Home) 업무 로직 + 소유권 검사."""

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.home import Home
from app.repositories.home_repository import HomeRepository


class HomeService:
    def __init__(self, db: Session) -> None:
        self.homes = HomeRepository(db)

    def list_homes(self, user_id: int) -> list[Home]:
        return self.homes.list_by_user(user_id)

    def get_owned(self, home_id: int, user_id: int) -> Home:
        """존재하며 현재 사용자 소유인 집만 반환. 아니면 404."""
        home = self.homes.get(home_id)
        if home is None or home.user_id != user_id:
            raise NotFoundError("해당 집을 찾을 수 없습니다.", error_code="HOME_NOT_FOUND")
        return home

    def create_home(self, user_id: int, *, name: str, description: str | None) -> Home:
        return self.homes.create(user_id=user_id, name=name, description=description)

    def update_home(
        self, home_id: int, user_id: int, *, name: str, description: str | None
    ) -> Home:
        home = self.get_owned(home_id, user_id)
        return self.homes.update(home, name=name, description=description)

    def delete_home(self, home_id: int, user_id: int) -> None:
        home = self.get_owned(home_id, user_id)
        self.homes.delete(home)
