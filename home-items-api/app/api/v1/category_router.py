"""카테고리(Category) 라우터."""

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.schemas.common import ApiResponse
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
def list_categories(
    current_user: CurrentUser, db: DbSession
) -> ApiResponse[list[CategoryResponse]]:
    items = CategoryService(db).list_categories(current_user.id)
    return ApiResponse(data=[CategoryResponse.model_validate(c) for c in items])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[CategoryResponse]:
    category = CategoryService(db).create(current_user.id, name=payload.name)
    return ApiResponse(data=CategoryResponse.model_validate(category))


@router.put("/{category_id}")
def update_category(
    category_id: int, payload: CategoryUpdate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[CategoryResponse]:
    category = CategoryService(db).update(category_id, current_user.id, name=payload.name)
    return ApiResponse(data=CategoryResponse.model_validate(category))


@router.delete("/{category_id}")
def delete_category(
    category_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[None]:
    CategoryService(db).delete(category_id, current_user.id)
    return ApiResponse(message="카테고리가 삭제되었습니다.")
