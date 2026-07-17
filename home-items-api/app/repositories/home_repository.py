"""Home 데이터베이스 접근 계층."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.home import Home


class HomeRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[Home]:
        stmt = select(Home).where(Home.user_id == user_id).order_by(Home.id)
        return list(self.db.execute(stmt).scalars().all())

    def get(self, home_id: int) -> Home | None:
        return self.db.get(Home, home_id)

    def create(self, *, user_id: int, name: str, description: str | None) -> Home:
        home = Home(user_id=user_id, name=name, description=description)
        self.db.add(home)
        self.db.commit()
        self.db.refresh(home)
        return home

    def update(self, home: Home, *, name: str, description: str | None) -> Home:
        home.name = name
        home.description = description
        self.db.commit()
        self.db.refresh(home)
        return home

    def delete(self, home: Home) -> None:
        self.db.delete(home)
        self.db.commit()
