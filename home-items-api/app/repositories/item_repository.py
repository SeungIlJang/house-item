"""Item 데이터베이스 접근 계층."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.item import Item
from app.models.tag import Tag

# 정렬 옵션 → ORDER BY 컬럼 매핑
_SORT_OPTIONS = {
    "newest": (Item.created_at.desc(), Item.id.desc()),
    "oldest": (Item.created_at.asc(), Item.id.asc()),
    "name": (Item.name.asc(), Item.id.asc()),
    "-name": (Item.name.desc(), Item.id.desc()),
}


class ItemRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _search_conditions(
        self,
        user_id: int,
        *,
        keyword: str | None,
        home_id: int | None,
        room_id: int | None,
        storage_location_id: int | None,
        category_id: int | None,
    ) -> list:
        conditions = [Item.user_id == user_id]
        if home_id is not None:
            conditions.append(Item.home_id == home_id)
        if room_id is not None:
            conditions.append(Item.room_id == room_id)
        if storage_location_id is not None:
            conditions.append(Item.storage_location_id == storage_location_id)
        if category_id is not None:
            conditions.append(Item.category_id == category_id)
        if keyword:
            like = f"%{keyword}%"
            conditions.append(
                or_(
                    Item.name.ilike(like),
                    Item.description.ilike(like),
                    Item.memo.ilike(like),
                )
            )
        return conditions

    def search(
        self,
        user_id: int,
        *,
        keyword: str | None = None,
        home_id: int | None = None,
        room_id: int | None = None,
        storage_location_id: int | None = None,
        category_id: int | None = None,
        tag_id: int | None = None,
        sort: str = "newest",
        offset: int,
        limit: int,
    ) -> tuple[list[Item], int]:
        conditions = self._search_conditions(
            user_id,
            keyword=keyword,
            home_id=home_id,
            room_id=room_id,
            storage_location_id=storage_location_id,
            category_id=category_id,
        )

        base = select(Item).where(*conditions)
        count_stmt = select(func.count(func.distinct(Item.id))).where(*conditions)
        if tag_id is not None:
            base = base.join(Item.tags).where(Tag.id == tag_id)
            count_stmt = count_stmt.select_from(Item).join(Item.tags).where(Tag.id == tag_id)

        order_by = _SORT_OPTIONS.get(sort, _SORT_OPTIONS["newest"])
        stmt = self._with_relations(base).order_by(*order_by).offset(offset).limit(limit).distinct()

        items = list(self.db.execute(stmt).scalars().unique().all())
        total = self.db.execute(count_stmt).scalar_one()
        return items, total

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
