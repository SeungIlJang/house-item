"""Item 데이터베이스 접근 계층."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.item import Item


class ItemRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _with_relations(self, stmt):
        return stmt.options(
            selectinload(Item.tags),
            selectinload(Item.category),
            selectinload(Item.room),
            selectinload(Item.storage_location),
            selectinload(Item.images),
        )

    def get(self, item_id: int) -> Item | None:
        stmt = self._with_relations(select(Item).where(Item.id == item_id))
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_user(self, user_id: int, *, offset: int, limit: int) -> list[Item]:
        stmt = (
            self._with_relations(select(Item).where(Item.user_id == user_id))
            .order_by(Item.created_at.desc(), Item.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    def count_by_user(self, user_id: int) -> int:
        stmt = select(func.count()).select_from(Item).where(Item.user_id == user_id)
        return self.db.execute(stmt).scalar_one()

    def add(self, item: Item) -> Item:
        self.db.add(item)
        self.db.commit()
        return self.get(item.id)  # type: ignore[return-value]

    def save(self, item: Item) -> Item:
        self.db.commit()
        return self.get(item.id)  # type: ignore[return-value]

    def delete(self, item: Item) -> None:
        self.db.delete(item)
        self.db.commit()
