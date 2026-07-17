"""물건(Item) 라우터."""

from fastapi import APIRouter, Query, status

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.common import ApiResponse, PageData
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.services.item_service import ItemService

router = APIRouter(prefix="/items", tags=["items"])


@router.get("")
def list_items(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> ApiResponse[PageData[ItemResponse]]:
    service = ItemService(db)
    items, total = service.list_items(current_user.id, page=page, size=size)
    total_pages = (total + size - 1) // size
    data = PageData(
        content=[service.to_response(i) for i in items],
        page=page,
        size=size,
        total_elements=total,
        total_pages=total_pages,
    )
    return ApiResponse(data=data)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[ItemResponse]:
    service = ItemService(db)
    item = service.create(current_user.id, payload)
    return ApiResponse(data=service.to_response(item), message="물건이 등록되었습니다.")


@router.get("/{item_id}")
def get_item(item_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[ItemResponse]:
    service = ItemService(db)
    item = service.get_owned(item_id, current_user.id)
    return ApiResponse(data=service.to_response(item))


@router.put("/{item_id}")
def update_item(
    item_id: int, payload: ItemUpdate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[ItemResponse]:
    service = ItemService(db)
    item = service.update(item_id, current_user.id, payload)
    return ApiResponse(data=service.to_response(item))


@router.delete("/{item_id}")
def delete_item(item_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[None]:
    ItemService(db).delete(item_id, current_user.id)
    return ApiResponse(message="물건이 삭제되었습니다.")
