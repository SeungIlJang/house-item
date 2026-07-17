"""물건(Item) 라우터."""

from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile, status

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.common import ApiResponse, PageData
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.schemas.item_image import ItemImageResponse
from app.services.item_image_service import ItemImageService
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


@router.get("/search")
def search_items(
    current_user: CurrentUser,
    db: DbSession,
    keyword: str | None = Query(None),
    home_id: int | None = Query(None),
    room_id: int | None = Query(None),
    storage_location_id: int | None = Query(None),
    category_id: int | None = Query(None),
    tag_id: int | None = Query(None),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> ApiResponse[PageData[ItemResponse]]:
    service = ItemService(db)
    items, total = service.search(
        current_user.id,
        keyword=keyword,
        home_id=home_id,
        room_id=room_id,
        storage_location_id=storage_location_id,
        category_id=category_id,
        tag_id=tag_id,
        sort=sort,
        page=page,
        size=size,
    )
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


# ----- 이미지 -----


@router.post("/{item_id}/images", status_code=status.HTTP_201_CREATED)
async def upload_item_image(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> ApiResponse[ItemImageResponse]:
    content = await file.read()
    image = ItemImageService(db).upload(
        item_id,
        current_user.id,
        content=content,
        filename=file.filename,
        content_type=file.content_type,
    )
    return ApiResponse(
        data=ItemImageResponse.model_validate(image), message="이미지가 업로드되었습니다."
    )


@router.delete("/{item_id}/images/{image_id}")
def delete_item_image(
    item_id: int, image_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[None]:
    ItemImageService(db).delete(item_id, image_id, current_user.id)
    return ApiResponse(message="이미지가 삭제되었습니다.")
