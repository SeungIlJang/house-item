"""물건(Item) 업무 로직.

연결된 집/방/수납공간/카테고리/태그의 소유권과 일관성을 검증합니다.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.item import Item
from app.repositories.item_repository import ItemRepository
from app.repositories.tag_repository import TagRepository
from app.schemas.item import ItemResponse
from app.schemas.item_image import ItemImageResponse
from app.schemas.tag import TagResponse
from app.services.category_service import CategoryService
from app.services.home_service import HomeService
from app.services.room_service import RoomService
from app.services.storage_service import StorageService


class ItemService:
    def __init__(self, db: Session) -> None:
        self.repo = ItemRepository(db)
        self.tags_repo = TagRepository(db)
        self.homes = HomeService(db)
        self.rooms = RoomService(db)
        self.storages = StorageService(db)
        self.categories = CategoryService(db)

    # ----- 조회 -----

    def get_owned(self, item_id: int, user_id: int) -> Item:
        item = self.repo.get(item_id)
        if item is None or item.user_id != user_id:
            raise NotFoundError("해당 물건을 찾을 수 없습니다.", error_code="ITEM_NOT_FOUND")
        return item

    def list_items(self, user_id: int, *, page: int, size: int) -> tuple[list[Item], int]:
        offset = (page - 1) * size
        items = self.repo.list_by_user(user_id, offset=offset, limit=size)
        total = self.repo.count_by_user(user_id)
        return items, total

    # ----- 생성/수정/삭제 -----

    def create(self, user_id: int, payload) -> Item:
        self._validate_links(user_id, payload)
        tags = self._load_tags(user_id, payload.tag_ids)
        item = Item(
            user_id=user_id,
            home_id=payload.home_id,
            room_id=payload.room_id,
            storage_location_id=payload.storage_location_id,
            category_id=payload.category_id,
            name=payload.name,
            description=payload.description,
            quantity=payload.quantity,
            memo=payload.memo,
            purchase_date=payload.purchase_date,
            expiration_date=payload.expiration_date,
        )
        item.tags = tags
        return self.repo.add(item)

    def update(self, item_id: int, user_id: int, payload) -> Item:
        item = self.get_owned(item_id, user_id)
        self._validate_links(user_id, payload)
        item.home_id = payload.home_id
        item.room_id = payload.room_id
        item.storage_location_id = payload.storage_location_id
        item.category_id = payload.category_id
        item.name = payload.name
        item.description = payload.description
        item.quantity = payload.quantity
        item.memo = payload.memo
        item.purchase_date = payload.purchase_date
        item.expiration_date = payload.expiration_date
        item.tags = self._load_tags(user_id, payload.tag_ids)
        return self.repo.save(item)

    def delete(self, item_id: int, user_id: int) -> None:
        item = self.get_owned(item_id, user_id)
        self.repo.delete(item)

    # ----- 응답 변환 -----

    def to_response(self, item: Item) -> ItemResponse:
        storage_path = (
            self.storages.full_path(item.storage_location)
            if item.storage_location is not None
            else None
        )
        images = [ItemImageResponse.model_validate(img) for img in item.images]
        thumbnail_url = images[0].image_url if images else None
        return ItemResponse(
            id=item.id,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            memo=item.memo,
            purchase_date=item.purchase_date,
            expiration_date=item.expiration_date,
            home_id=item.home_id,
            room_id=item.room_id,
            storage_location_id=item.storage_location_id,
            category_id=item.category_id,
            category_name=item.category.name if item.category else None,
            room_name=item.room.name if item.room else None,
            storage_full_path=storage_path,
            tags=[TagResponse.model_validate(t) for t in item.tags],
            images=images,
            thumbnail_url=thumbnail_url,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    # ----- 내부 검증 -----

    def _validate_links(self, user_id: int, payload) -> None:
        # 집(필수)
        self.homes.get_owned(payload.home_id, user_id)

        # 방(선택): 집에 속해야 함
        if payload.room_id is not None:
            room = self.rooms.get_owned(payload.room_id, user_id)
            if room.home_id != payload.home_id:
                raise ConflictError(
                    "방이 선택한 집에 속하지 않습니다.", error_code="ROOM_HOME_MISMATCH"
                )

        # 수납공간(선택): 방이 지정되어 있고, 그 방에 속해야 함
        if payload.storage_location_id is not None:
            if payload.room_id is None:
                raise ConflictError(
                    "수납공간을 지정하려면 방을 먼저 선택해야 합니다.",
                    error_code="STORAGE_WITHOUT_ROOM",
                )
            storage = self.storages.get_owned(payload.storage_location_id, user_id)
            if storage.room_id != payload.room_id:
                raise ConflictError(
                    "수납공간이 선택한 방에 속하지 않습니다.",
                    error_code="STORAGE_ROOM_MISMATCH",
                )

        # 카테고리(선택)
        if payload.category_id is not None:
            self.categories.get_owned(payload.category_id, user_id)

    def _load_tags(self, user_id: int, tag_ids: list[int]):
        unique_ids = list(dict.fromkeys(tag_ids))
        tags = self.tags_repo.list_by_ids(user_id, unique_ids)
        if len(tags) != len(unique_ids):
            raise NotFoundError(
                "존재하지 않거나 소유하지 않은 태그가 포함되어 있습니다.",
                error_code="TAG_NOT_FOUND",
            )
        return tags
