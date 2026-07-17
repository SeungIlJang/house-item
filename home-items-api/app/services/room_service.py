"""방(Room) 업무 로직 + 소유권 검사.

방의 소유권은 상위 집(Home)의 user_id 로 판단합니다.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.room import Room
from app.repositories.room_repository import RoomRepository
from app.services.home_service import HomeService


class RoomService:
    def __init__(self, db: Session) -> None:
        self.rooms = RoomRepository(db)
        self.homes = HomeService(db)

    def list_rooms(self, home_id: int, user_id: int) -> list[Room]:
        self.homes.get_owned(home_id, user_id)  # 소유권 확인
        return self.rooms.list_by_home(home_id)

    def get_owned(self, room_id: int, user_id: int) -> Room:
        room = self.rooms.get(room_id)
        if room is None:
            raise NotFoundError("해당 방을 찾을 수 없습니다.", error_code="ROOM_NOT_FOUND")
        # 상위 집이 현재 사용자 소유인지 확인
        self.homes.get_owned(room.home_id, user_id)
        return room

    def create_room(
        self,
        home_id: int,
        user_id: int,
        *,
        name: str,
        description: str | None,
        sort_order: int,
    ) -> Room:
        self.homes.get_owned(home_id, user_id)
        return self.rooms.create(
            home_id=home_id, name=name, description=description, sort_order=sort_order
        )

    def update_room(
        self,
        room_id: int,
        user_id: int,
        *,
        name: str,
        description: str | None,
        sort_order: int,
    ) -> Room:
        room = self.get_owned(room_id, user_id)
        return self.rooms.update(room, name=name, description=description, sort_order=sort_order)

    def delete_room(self, room_id: int, user_id: int) -> None:
        room = self.get_owned(room_id, user_id)
        self.rooms.delete(room)
