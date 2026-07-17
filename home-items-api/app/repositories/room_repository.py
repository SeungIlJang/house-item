"""Room 데이터베이스 접근 계층."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room import Room


class RoomRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_home(self, home_id: int) -> list[Room]:
        stmt = select(Room).where(Room.home_id == home_id).order_by(Room.sort_order, Room.id)
        return list(self.db.execute(stmt).scalars().all())

    def get(self, room_id: int) -> Room | None:
        return self.db.get(Room, room_id)

    def create(self, *, home_id: int, name: str, description: str | None, sort_order: int) -> Room:
        room = Room(home_id=home_id, name=name, description=description, sort_order=sort_order)
        self.db.add(room)
        self.db.commit()
        self.db.refresh(room)
        return room

    def update(self, room: Room, *, name: str, description: str | None, sort_order: int) -> Room:
        room.name = name
        room.description = description
        room.sort_order = sort_order
        self.db.commit()
        self.db.refresh(room)
        return room

    def delete(self, room: Room) -> None:
        self.db.delete(room)
        self.db.commit()
