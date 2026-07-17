"""Category 데이터베이스 접근 계층."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category


class CategoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[Category]:
        stmt = select(Category).where(Category.user_id == user_id).order_by(Category.name)
        return list(self.db.execute(stmt).scalars().all())

    def get(self, category_id: int) -> Category | None:
        return self.db.get(Category, category_id)

    def get_by_name(self, user_id: int, name: str) -> Category | None:
        stmt = select(Category).where(Category.user_id == user_id, Category.name == name)
        return self.db.execute(stmt).scalar_one_or_none()

    def create(self, *, user_id: int, name: str) -> Category:
        category = Category(user_id=user_id, name=name)
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def update(self, category: Category, *, name: str) -> Category:
        category.name = name
        self.db.commit()
        self.db.refresh(category)
        return category

    def delete(self, category: Category) -> None:
        self.db.delete(category)
        self.db.commit()
