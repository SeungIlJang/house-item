"""태그(Tag) 요청·응답 스키마."""

from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class TagCreate(CamelModel):
    name: str = Field(min_length=1, max_length=50)


class TagUpdate(CamelModel):
    name: str = Field(min_length=1, max_length=50)


class TagResponse(CamelModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
