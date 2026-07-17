"""수납공간(StorageLocation) 라우터."""

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.common import ApiResponse
from app.schemas.storage_location import (
    StorageLocationCreate,
    StorageLocationResponse,
    StorageLocationTreeNode,
    StorageLocationUpdate,
)
from app.services.storage_service import StorageService


def _to_response(service: StorageService, storage) -> StorageLocationResponse:
    return StorageLocationResponse(
        id=storage.id,
        room_id=storage.room_id,
        parent_id=storage.parent_id,
        name=storage.name,
        description=storage.description,
        sort_order=storage.sort_order,
        full_path=service.full_path(storage),
        created_at=storage.created_at,
        updated_at=storage.updated_at,
    )


# 방에 종속된 트리 조회/생성
room_router = APIRouter(prefix="/rooms", tags=["storage-locations"])


@room_router.get("/{room_id}/storage-locations")
def list_tree(
    room_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[list[StorageLocationTreeNode]]:
    service = StorageService(db)
    tree = service.list_tree(room_id, current_user.id)
    return ApiResponse(data=tree)


@room_router.post("/{room_id}/storage-locations", status_code=status.HTTP_201_CREATED)
def create_storage(
    room_id: int,
    payload: StorageLocationCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[StorageLocationResponse]:
    service = StorageService(db)
    storage = service.create(
        room_id,
        current_user.id,
        name=payload.name,
        description=payload.description,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
    )
    return ApiResponse(data=_to_response(service, storage))


# 단건 수납공간
storage_router = APIRouter(prefix="/storage-locations", tags=["storage-locations"])


@storage_router.get("/{storage_id}")
def get_storage(
    storage_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[StorageLocationResponse]:
    service = StorageService(db)
    storage = service.get_owned(storage_id, current_user.id)
    return ApiResponse(data=_to_response(service, storage))


@storage_router.put("/{storage_id}")
def update_storage(
    storage_id: int,
    payload: StorageLocationUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[StorageLocationResponse]:
    service = StorageService(db)
    storage = service.update(
        storage_id,
        current_user.id,
        name=payload.name,
        description=payload.description,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
    )
    return ApiResponse(data=_to_response(service, storage))


@storage_router.delete("/{storage_id}")
def delete_storage(storage_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[None]:
    StorageService(db).delete(storage_id, current_user.id)
    return ApiResponse(message="수납공간이 삭제되었습니다.")
