"""방(Room) 단건 조회/수정/삭제 라우터."""

from fastapi import APIRouter

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.common import ApiResponse
from app.schemas.room import RoomResponse, RoomUpdate
from app.services.room_service import RoomService

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/{room_id}")
def get_room(room_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[RoomResponse]:
    room = RoomService(db).get_owned(room_id, current_user.id)
    return ApiResponse(data=RoomResponse.model_validate(room))


@router.put("/{room_id}")
def update_room(
    room_id: int, payload: RoomUpdate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[RoomResponse]:
    room = RoomService(db).update_room(
        room_id,
        current_user.id,
        name=payload.name,
        description=payload.description,
        sort_order=payload.sort_order,
    )
    return ApiResponse(data=RoomResponse.model_validate(room))


@router.delete("/{room_id}")
def delete_room(room_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[None]:
    RoomService(db).delete_room(room_id, current_user.id)
    return ApiResponse(message="방이 삭제되었습니다.")
