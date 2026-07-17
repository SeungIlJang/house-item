"""ItemImage 데이터베이스 접근 계층."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.item_image import ItemImage


class ItemImageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, image_id: int) -> ItemImage | None:
        return self.db.get(ItemImage, image_id)

    def next_sort_order(self, item_id: int) -> int:
        stmt = select(func.coalesce(func.max(ItemImage.sort_order), -1)).where(
            ItemImage.item_id == item_id
        )
        return self.db.execute(stmt).scalar_one() + 1

    def create(
        self, *, item_id: int, image_url: str, original_filename: str | None, sort_order: int
    ) -> ItemImage:
        image = ItemImage(
            item_id=item_id,
            image_url=image_url,
            original_filename=original_filename,
            sort_order=sort_order,
        )
        self.db.add(image)
        self.db.commit()
        self.db.refresh(image)
        return image

    def delete(self, image: ItemImage) -> None:
        self.db.delete(image)
        self.db.commit()
