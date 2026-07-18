"""물건(Item) 요청·응답 스키마."""

from datetime import date, datetime

from pydantic import Field, model_validator

from app.schemas.common import CamelModel
from app.schemas.item_image import ItemImageResponse
from app.schemas.tag import TagResponse


class ItemBase(CamelModel):
    # 이름은 선택. 장소(room_id)만 필수로 취급(프론트에서 강제).
    name: str = Field(default="", max_length=200)
    description: str | None = None
    quantity: int = Field(default=1, ge=0)
    memo: str | None = None
    purchase_date: date | None = None
    expiration_date: date | None = None
    home_id: int
    room_id: int | None = None
    storage_location_id: int | None = None
    category_id: int | None = None
    tag_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check_dates(self) -> "ItemBase":
        if (
            self.purchase_date is not None
            and self.expiration_date is not None
            and self.expiration_date < self.purchase_date
        ):
            raise ValueError("유효기간은 구매일보다 빠를 수 없습니다.")
        return self


class ItemCreate(ItemBase):
    pass


class ItemUpdate(ItemBase):
    pass


class ItemResponse(CamelModel):
    id: int
    name: str
    description: str | None
    quantity: int
    memo: str | None
    purchase_date: date | None
    expiration_date: date | None
    home_id: int
    room_id: int | None
    storage_location_id: int | None
    category_id: int | None
    category_name: str | None
    room_name: str | None
    storage_full_path: str | None
    tags: list[TagResponse]
    images: list[ItemImageResponse]
    thumbnail_url: str | None  # -> thumbnailUrl (대표 이미지)
    created_at: datetime
    updated_at: datetime
