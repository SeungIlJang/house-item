"""StorageLocation 데이터베이스 접근 계층."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.storage_location import StorageLocation


class StorageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, storage_id: int) -> StorageLocation | None:
        return self.db.get(StorageLocation, storage_id)

    def list_by_room(self, room_id: int) -> list[StorageLocation]:
        stmt = (
            select(StorageLocation)
            .where(StorageLocation.room_id == room_id)
            .order_by(StorageLocation.sort_order, StorageLocation.id)
        )
        return list(self.db.execute(stmt).scalars().all())

    def create(
        self,
        *,
        room_id: int,
        parent_id: int | None,
        name: str,
        description: str | None,
        sort_order: int,
    ) -> StorageLocation:
        storage = StorageLocation(
            room_id=room_id,
            parent_id=parent_id,
            name=name,
            description=description,
            sort_order=sort_order,
        )
        self.db.add(storage)
        self.db.commit()
        self.db.refresh(storage)
        return storage

    def update(
        self,
        storage: StorageLocation,
        *,
        parent_id: int | None,
        name: str,
        description: str | None,
        sort_order: int,
    ) -> StorageLocation:
        storage.parent_id = parent_id
        storage.name = name
        storage.description = description
        storage.sort_order = sort_order
        self.db.commit()
        self.db.refresh(storage)
        return storage

    def delete(self, storage: StorageLocation) -> None:
        self.db.delete(storage)
        self.db.commit()
