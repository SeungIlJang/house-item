"""태그(Tag) 업무 로직 + 소유권/중복 검사."""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.tag import Tag
from app.repositories.tag_repository import TagRepository


class TagService:
    def __init__(self, db: Session) -> None:
        self.repo = TagRepository(db)

    def list_tags(self, user_id: int) -> list[Tag]:
        return self.repo.list_by_user(user_id)

    def get_owned(self, tag_id: int, user_id: int) -> Tag:
        tag = self.repo.get(tag_id)
        if tag is None or tag.user_id != user_id:
            raise NotFoundError("해당 태그를 찾을 수 없습니다.", error_code="TAG_NOT_FOUND")
        return tag

    def create(self, user_id: int, *, name: str) -> Tag:
        self._ensure_unique_name(user_id, name)
        return self.repo.create(user_id=user_id, name=name)

    def update(self, tag_id: int, user_id: int, *, name: str) -> Tag:
        tag = self.get_owned(tag_id, user_id)
        if name != tag.name:
            self._ensure_unique_name(user_id, name)
        return self.repo.update(tag, name=name)

    def delete(self, tag_id: int, user_id: int) -> None:
        tag = self.get_owned(tag_id, user_id)
        self.repo.delete(tag)

    def _ensure_unique_name(self, user_id: int, name: str) -> None:
        if self.repo.get_by_name(user_id, name) is not None:
            raise ConflictError("이미 같은 이름의 태그가 있습니다.", error_code="TAG_DUPLICATE")
