"""공통 응답 스키마.

모든 API가 같은 모양으로 응답하도록 래퍼를 제공합니다.
JSON 필드는 camelCase 로 내보내고, 파이썬 내부는 snake_case 를 유지합니다.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """snake_case 필드를 camelCase 로 직렬화하는 기본 모델."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ApiResponse[T](CamelModel):
    success: bool = True
    data: T | None = None
    message: str | None = None


class PageData[T](CamelModel):
    content: list[T]
    page: int
    size: int
    total_elements: int  # -> totalElements
    total_pages: int  # -> totalPages


def success_response(data: object = None, message: str | None = None) -> dict:
    """라우터에서 간단히 성공 응답 dict 를 만들 때 사용."""
    return {"success": True, "data": data, "message": message}
