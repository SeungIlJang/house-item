"""물건 이미지 업로드/삭제 업무 로직.

어떤 이미지든(HEIC/HEIF 포함) 받아서 JPEG/PNG 로 변환해 저장합니다.
- 형식은 확장자/MIME 로 막지 않고, 실제로 디코딩되는 이미지인지로 판단
- 저장 시 긴 변 최대 1600px 로 축소 + 재인코딩(용량 절감)
"""

import uuid
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, NotFoundError
from app.models.item_image import ItemImage
from app.repositories.item_image_repository import ItemImageRepository
from app.services.file_storage import get_file_storage
from app.services.item_service import ItemService

# HEIC/HEIF(삼성·아이폰 카메라 기본 형식) 디코딩 지원
try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:  # pragma: no cover
    pass

MAX_FILE_SIZE = 20 * 1024 * 1024  # 업로드 원본 상한 20MB (변환·압축 후 저장은 훨씬 작음)

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
        self._check_size(content)

        # 어떤 형식이든 열어서 JPEG/PNG 로 변환 (HEIC 등 → 등록 가능한 형식)
        data, out_ext = self._process_image(content)

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

    def _process_image(self, content: bytes) -> tuple[bytes, str]:
        """이미지를 열어 저장 가능한 형식(JPEG/PNG)으로 변환한다.

        - 디코딩 불가(이미지가 아님) → 오류
        - 애니메이션 GIF: 원본 유지(.gif)
        - 투명 이미지(alpha): PNG 로 저장
        - 그 외(HEIC/JPEG/WEBP 등): JPEG(품질 85)로 변환
        """
        try:
            image = Image.open(BytesIO(content))
            image.load()
        except (UnidentifiedImageError, OSError, ValueError):
            raise AppError(
                "이미지 파일이 아니거나 지원하지 않는 형식입니다.",
                error_code="INVALID_IMAGE",
            ) from None

        # 애니메이션 GIF 는 그대로 보존
        if getattr(image, "format", None) == "GIF" and getattr(image, "is_animated", False):
            return content, ".gif"

        image = ImageOps.exif_transpose(image)  # 촬영 방향(EXIF) 보정
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

    def _check_size(self, content: bytes) -> None:
        if not content:
            raise AppError("빈 파일은 업로드할 수 없습니다.", error_code="EMPTY_FILE")
        if len(content) > MAX_FILE_SIZE:
            raise AppError(
                "이미지 크기는 20MB 를 넘을 수 없습니다.",
                error_code="FILE_TOO_LARGE",
                status_code=413,
            )
