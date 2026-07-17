"""태그(Tag) 라우터."""

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.common import ApiResponse
from app.schemas.tag import TagCreate, TagResponse, TagUpdate
from app.services.tag_service import TagService

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("")
def list_tags(current_user: CurrentUser, db: DbSession) -> ApiResponse[list[TagResponse]]:
    items = TagService(db).list_tags(current_user.id)
    return ApiResponse(data=[TagResponse.model_validate(t) for t in items])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_tag(
    payload: TagCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TagResponse]:
    tag = TagService(db).create(current_user.id, name=payload.name)
    return ApiResponse(data=TagResponse.model_validate(tag))


@router.put("/{tag_id}")
def update_tag(
    tag_id: int, payload: TagUpdate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TagResponse]:
    tag = TagService(db).update(tag_id, current_user.id, name=payload.name)
    return ApiResponse(data=TagResponse.model_validate(tag))


@router.delete("/{tag_id}")
def delete_tag(tag_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[None]:
    TagService(db).delete(tag_id, current_user.id)
    return ApiResponse(message="태그가 삭제되었습니다.")
