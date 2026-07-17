"""방(Room) 요청·응답 스키마."""

from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class RoomCreate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    sort_order: int = 0


class RoomUpdate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    sort_order: int = 0


class RoomResponse(CamelModel):
    id: int
    home_id: int
    name: str
    description: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime
