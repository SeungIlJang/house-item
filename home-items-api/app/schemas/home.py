"""집(Home) 요청·응답 스키마."""

from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class HomeCreate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class HomeUpdate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class HomeResponse(CamelModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
