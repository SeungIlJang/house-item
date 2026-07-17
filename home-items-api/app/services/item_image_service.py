"""물건 이미지 업로드/삭제 업무 로직.

파일 검증(확장자·MIME·크기) 후 저장소(FileStorage)에 저장합니다.
"""

import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, NotFoundError
from app.models.item_image import ItemImage
from app.repositories.item_image_repository import ItemImageRepository
from app.services.file_storage import get_file_storage
from app.services.item_service import ItemService

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 업로드 원본 상한 10MB (압축 후 저장은 훨씬 작아짐)

# 저장 시 리사이즈/압축 설정
MAX_DIMENSION = 1600  # 긴 변 최대 px
JPEG_QUALITY = 85


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

        # 저장 전 리사이즈/압축 (실패 시 원본 유지)
        data, out_ext = self._process_image(content, ext)

        key = f"items/{user_id}/{item_id}/{uuid.uuid4().hex}{out_ext}"
        image_url = self.storage.save(content=data, key=key)

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

    def _process_image(self, content: bytes, ext: str) -> tuple[bytes, str]:
        """긴 변 기준으로 축소하고 재인코딩해 용량을 줄인다.

        - GIF: 애니메이션 보존을 위해 원본 유지
        - 투명 이미지(alpha): PNG 로 저장
        - 그 외: JPEG(품질 85)로 저장
        - 처리 실패 시 원본을 그대로 반환
        """
        if ext == ".gif":
            return content, ext
        try:
            image = Image.open(BytesIO(content))
            image = ImageOps.exif_transpose(image)  # 촬영 방향(EXIF) 보정
        except (UnidentifiedImageError, OSError):
            return content, ext

        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))  # 비율 유지 축소

        has_alpha = image.mode in ("RGBA", "LA") or (
            image.mode == "P" and "transparency" in image.info
        )
        buffer = BytesIO()
        if has_alpha:
            image.convert("RGBA").save(buffer, format="PNG", optimize=True)
            return buffer.getvalue(), ".png"
        image.convert("RGB").save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        return buffer.getvalue(), ".jpg"

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
