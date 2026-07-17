"""물건 이미지 업로드/삭제 업무 로직.

파일 검증(확장자·MIME·크기) 후 저장소(FileStorage)에 저장합니다.
"""

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.exceptions import AppError, NotFoundError
from app.models.item_image import ItemImage
from app.repositories.item_image_repository import ItemImageRepository
from app.services.file_storage import get_file_storage
from app.services.item_service import ItemService

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


class ItemImageService:
    def __init__(self, db: Session) -> None:
        self.repo = ItemImageRepository(db)
        self.items = ItemService(db)
        self.storage = get_file_storage()

    def upload(
        self,
        item_id: int,
        user_id: int,
        *,
        content: bytes,
        filename: str | None,
        content_type: str | None,
    ) -> ItemImage:
        item = self.items.get_owned(item_id, user_id)  # 소유권 확인
        ext = self._validate(content=content, filename=filename, content_type=content_type)

        key = f"items/{user_id}/{item_id}/{uuid.uuid4().hex}{ext}"
        image_url = self.storage.save(content=content, key=key)

        sort_order = self.repo.next_sort_order(item.id)
        return self.repo.create(
            item_id=item.id,
            image_url=image_url,
            original_filename=filename,
            sort_order=sort_order,
        )

    def delete(self, item_id: int, image_id: int, user_id: int) -> None:
        self.items.get_owned(item_id, user_id)  # 소유권 확인
        image = self.repo.get(image_id)
        if image is None or image.item_id != item_id:
            raise NotFoundError("해당 이미지를 찾을 수 없습니다.", error_code="IMAGE_NOT_FOUND")
        self.storage.delete(image.image_url)
        self.repo.delete(image)

    def _validate(self, *, content: bytes, filename: str | None, content_type: str | None) -> str:
        if not content:
            raise AppError("빈 파일은 업로드할 수 없습니다.", error_code="EMPTY_FILE")
        if len(content) > MAX_FILE_SIZE:
            raise AppError(
                "이미지 크기는 5MB 를 넘을 수 없습니다.",
                error_code="FILE_TOO_LARGE",
                status_code=413,
            )
        ext = Path(filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise AppError("허용되지 않는 파일 형식입니다.", error_code="INVALID_FILE_EXTENSION")
        if content_type not in ALLOWED_MIME_TYPES:
            raise AppError("허용되지 않는 파일 형식입니다.", error_code="INVALID_MIME_TYPE")
        return ext
