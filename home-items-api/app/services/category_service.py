"""카테고리(Category) 업무 로직 + 소유권/중복 검사."""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.category import Category
from app.repositories.category_repository import CategoryRepository


class CategoryService:
    def __init__(self, db: Session) -> None:
        self.repo = CategoryRepository(db)

    def list_categories(self, user_id: int) -> list[Category]:
        return self.repo.list_by_user(user_id)

    def get_owned(self, category_id: int, user_id: int) -> Category:
        category = self.repo.get(category_id)
        if category is None or category.user_id != user_id:
            raise NotFoundError(
                "해당 카테고리를 찾을 수 없습니다.", error_code="CATEGORY_NOT_FOUND"
            )
        return category

    def create(self, user_id: int, *, name: str) -> Category:
        self._ensure_unique_name(user_id, name)
        return self.repo.create(user_id=user_id, name=name)

    def update(self, category_id: int, user_id: int, *, name: str) -> Category:
        category = self.get_owned(category_id, user_id)
        if name != category.name:
            self._ensure_unique_name(user_id, name)
        return self.repo.update(category, name=name)

    def delete(self, category_id: int, user_id: int) -> None:
        category = self.get_owned(category_id, user_id)
        self.repo.delete(category)

    def _ensure_unique_name(self, user_id: int, name: str) -> None:
        if self.repo.get_by_name(user_id, name) is not None:
            raise ConflictError(
                "이미 같은 이름의 카테고리가 있습니다.", error_code="CATEGORY_DUPLICATE"
            )
