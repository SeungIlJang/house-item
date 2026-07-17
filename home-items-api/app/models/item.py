"""Item 모델 (items 테이블)과 item_tags 연결표."""

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Column, Date, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.item_image import ItemImage
    from app.models.room import Room
    from app.models.storage_location import StorageLocation
    from app.models.tag import Tag


# 물건 ↔ 태그: 다대다 연결표
item_tags = Table(
    "item_tags",
    Base.metadata,
    Column("item_id", ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Item(Base, TimestampMixin):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    home_id: Mapped[int] = mapped_column(
        ForeignKey("homes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    room_id: Mapped[int | None] = mapped_column(
        ForeignKey("rooms.id", ondelete="SET NULL"), index=True, nullable=True
    )
    storage_location_id: Mapped[int | None] = mapped_column(
        ForeignKey("storage_locations.id", ondelete="SET NULL"), index=True, nullable=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiration_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    category: Mapped["Category | None"] = relationship()
    room: Mapped["Room | None"] = relationship()
    storage_location: Mapped["StorageLocation | None"] = relationship()
    tags: Mapped[list["Tag"]] = relationship(secondary=item_tags)
    images: Mapped[list["ItemImage"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ItemImage.sort_order",
    )
