"""Tag 데이터베이스 접근 계층."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tag import Tag


class TagRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[Tag]:
        stmt = select(Tag).where(Tag.user_id == user_id).order_by(Tag.name)
        return list(self.db.execute(stmt).scalars().all())

    def get(self, tag_id: int) -> Tag | None:
        return self.db.get(Tag, tag_id)

    def get_by_name(self, user_id: int, name: str) -> Tag | None:
        stmt = select(Tag).where(Tag.user_id == user_id, Tag.name == name)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_ids(self, user_id: int, ids: list[int]) -> list[Tag]:
        if not ids:
            return []
        stmt = select(Tag).where(Tag.user_id == user_id, Tag.id.in_(ids))
        return list(self.db.execute(stmt).scalars().all())

    def create(self, *, user_id: int, name: str) -> Tag:
        tag = Tag(user_id=user_id, name=name)
        self.db.add(tag)
        self.db.commit()
        self.db.refresh(tag)
        return tag

    def update(self, tag: Tag, *, name: str) -> Tag:
        tag.name = name
        self.db.commit()
        self.db.refresh(tag)
        return tag

    def delete(self, tag: Tag) -> None:
        self.db.delete(tag)
        self.db.commit()
