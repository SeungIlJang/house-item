"""StorageLocation 모델 (storage_locations 테이블).

parent_id 로 자기 자신을 참조하는 계층형 구조.
예) 붙박이장 > 오른쪽 칸 > 두 번째 서랍
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.room import Room


class StorageLocation(Base, TimestampMixin):
    __tablename__ = "storage_locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True, nullable=False
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("storage_locations.id", ondelete="CASCADE"), index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)

    room: Mapped["Room"] = relationship()
    parent: Mapped["StorageLocation | None"] = relationship(
        back_populates="children", remote_side=[id]
    )
    children: Mapped[list["StorageLocation"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
