"""물건 이미지(ItemImage) 응답 스키마."""

from datetime import datetime

from app.schemas.common import CamelModel


class ItemImageResponse(CamelModel):
    id: int
    image_url: str  # -> imageUrl
    original_filename: str | None  # -> originalFilename
    sort_order: int  # -> sortOrder
    created_at: datetime
