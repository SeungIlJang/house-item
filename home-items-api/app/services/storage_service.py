"""수납공간(StorageLocation) 업무 로직.

- 소유권: 상위 Room → Home → user 로 판단
- 계층: parent_id
- 순환 참조 방지: 자신 또는 자손을 parent 로 지정 금지
- 전체 경로(fullPath) 생성
"""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.storage_location import StorageLocation
from app.repositories.storage_repository import StorageRepository
from app.schemas.storage_location import StorageLocationTreeNode
from app.services.room_service import RoomService


class StorageService:
    def __init__(self, db: Session) -> None:
        self.repo = StorageRepository(db)
        self.rooms = RoomService(db)

    # ----- 조회 -----

    def get_owned(self, storage_id: int, user_id: int) -> StorageLocation:
        storage = self.repo.get(storage_id)
        if storage is None:
            raise NotFoundError("해당 수납공간을 찾을 수 없습니다.", error_code="STORAGE_NOT_FOUND")
        self.rooms.get_owned(storage.room_id, user_id)  # 소유권 확인
        return storage

    def list_tree(self, room_id: int, user_id: int) -> list[StorageLocationTreeNode]:
        self.rooms.get_owned(room_id, user_id)
        items = self.repo.list_by_room(room_id)
        return self._build_tree(items)

    def full_path(self, storage: StorageLocation) -> str:
        """방 이름부터 시작하는 전체 경로. 예) 안방 > 붙박이장 > 두 번째 서랍"""
        names: list[str] = []
        node: StorageLocation | None = storage
        # 부모를 따라 위로 올라가며 이름 수집 (깊이 제한으로 안전장치)
        guard = 0
        while node is not None and guard < 100:
            names.append(node.name)
            node = node.parent
            guard += 1
        names.reverse()
        return " > ".join([storage.room.name, *names])

    # ----- 생성/수정/삭제 -----

    def create(
        self,
        room_id: int,
        user_id: int,
        *,
        name: str,
        description: str | None,
        parent_id: int | None,
        sort_order: int,
    ) -> StorageLocation:
        self.rooms.get_owned(room_id, user_id)
        if parent_id is not None:
            self._validate_parent_same_room(parent_id, room_id)
        return self.repo.create(
            room_id=room_id,
            parent_id=parent_id,
            name=name,
            description=description,
            sort_order=sort_order,
        )

    def update(
        self,
        storage_id: int,
        user_id: int,
        *,
        name: str,
        description: str | None,
        parent_id: int | None,
        sort_order: int,
    ) -> StorageLocation:
        storage = self.get_owned(storage_id, user_id)
        if parent_id is not None:
            self._validate_parent_same_room(parent_id, storage.room_id)
            self._validate_no_cycle(storage, parent_id)
        return self.repo.update(
            storage,
            parent_id=parent_id,
            name=name,
            description=description,
            sort_order=sort_order,
        )

    def delete(self, storage_id: int, user_id: int) -> None:
        storage = self.get_owned(storage_id, user_id)
        self.repo.delete(storage)

    # ----- 내부 헬퍼 -----

    def _validate_parent_same_room(self, parent_id: int, room_id: int) -> None:
        parent = self.repo.get(parent_id)
        if parent is None or parent.room_id != room_id:
            raise NotFoundError("상위 수납공간을 찾을 수 없습니다.", error_code="PARENT_NOT_FOUND")

    def _validate_no_cycle(self, storage: StorageLocation, new_parent_id: int) -> None:
        if new_parent_id == storage.id:
            raise ConflictError(
                "자기 자신을 상위로 지정할 수 없습니다.", error_code="STORAGE_CYCLE"
            )
        # 같은 방의 전체 목록으로 자손 집합을 구해, 새 부모가 자손이면 거부
        items = self.repo.list_by_room(storage.room_id)
        children_map: dict[int | None, list[StorageLocation]] = {}
        for item in items:
            children_map.setdefault(item.parent_id, []).append(item)

        descendants: set[int] = set()
        stack = [storage.id]
        while stack:
            current = stack.pop()
            for child in children_map.get(current, []):
                if child.id not in descendants:
                    descendants.add(child.id)
                    stack.append(child.id)

        if new_parent_id in descendants:
            raise ConflictError(
                "하위 수납공간을 상위로 지정할 수 없습니다.", error_code="STORAGE_CYCLE"
            )

    def _build_tree(self, items: list[StorageLocation]) -> list[StorageLocationTreeNode]:
        nodes: dict[int, StorageLocationTreeNode] = {
            item.id: StorageLocationTreeNode(
                id=item.id,
                room_id=item.room_id,
                parent_id=item.parent_id,
                name=item.name,
                description=item.description,
                sort_order=item.sort_order,
                children=[],
            )
            for item in items
        }
        roots: list[StorageLocationTreeNode] = []
        for item in items:
            node = nodes[item.id]
            if item.parent_id is None:
                roots.append(node)
            else:
                parent = nodes.get(item.parent_id)
                if parent is not None:
                    parent.children.append(node)
        return roots
