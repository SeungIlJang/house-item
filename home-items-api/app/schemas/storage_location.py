"""수납공간(StorageLocation) 요청·응답 스키마."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class StorageLocationCreate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    parent_id: int | None = None  # -> parentId
    sort_order: int = 0


class StorageLocationUpdate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    parent_id: int | None = None
    sort_order: int = 0


class StorageLocationResponse(CamelModel):
    id: int
    room_id: int
    parent_id: int | None
    name: str
    description: str | None
    sort_order: int
    full_path: str  # -> fullPath  (예: "안방 > 붙박이장 > 두 번째 서랍")
    created_at: datetime
    updated_at: datetime


class StorageLocationTreeNode(CamelModel):
    id: int
    room_id: int
    parent_id: int | None
    name: str
    description: str | None
    sort_order: int
    children: list[StorageLocationTreeNode] = []
