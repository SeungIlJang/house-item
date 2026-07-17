"""집(Home)과 방 목록/생성 라우터."""

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.common import ApiResponse
from app.schemas.home import HomeCreate, HomeResponse, HomeUpdate
from app.schemas.room import RoomCreate, RoomResponse
from app.services.home_service import HomeService
from app.services.room_service import RoomService

router = APIRouter(prefix="/homes", tags=["homes"])


@router.get("")
def list_homes(current_user: CurrentUser, db: DbSession) -> ApiResponse[list[HomeResponse]]:
    homes = HomeService(db).list_homes(current_user.id)
    return ApiResponse(data=[HomeResponse.model_validate(h) for h in homes])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_home(
    payload: HomeCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[HomeResponse]:
    home = HomeService(db).create_home(
        current_user.id, name=payload.name, description=payload.description
    )
    return ApiResponse(data=HomeResponse.model_validate(home))


@router.get("/{home_id}")
def get_home(home_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[HomeResponse]:
    home = HomeService(db).get_owned(home_id, current_user.id)
    return ApiResponse(data=HomeResponse.model_validate(home))


@router.put("/{home_id}")
def update_home(
    home_id: int, payload: HomeUpdate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[HomeResponse]:
    home = HomeService(db).update_home(
        home_id, current_user.id, name=payload.name, description=payload.description
    )
    return ApiResponse(data=HomeResponse.model_validate(home))


@router.delete("/{home_id}")
def delete_home(home_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[None]:
    HomeService(db).delete_home(home_id, current_user.id)
    return ApiResponse(message="집이 삭제되었습니다.")


# ----- 방(Room) 목록/생성: 집에 종속 -----


@router.get("/{home_id}/rooms")
def list_rooms(
    home_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[list[RoomResponse]]:
    rooms = RoomService(db).list_rooms(home_id, current_user.id)
    return ApiResponse(data=[RoomResponse.model_validate(r) for r in rooms])


@router.post("/{home_id}/rooms", status_code=status.HTTP_201_CREATED)
def create_room(
    home_id: int, payload: RoomCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[RoomResponse]:
    room = RoomService(db).create_room(
        home_id,
        current_user.id,
        name=payload.name,
        description=payload.description,
        sort_order=payload.sort_order,
    )
    return ApiResponse(data=RoomResponse.model_validate(room))
