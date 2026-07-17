"""모델 패키지.

여기서 모든 모델을 import 해 두면 Alembic autogenerate 와
SQLAlchemy 관계 설정이 모델을 인식합니다.
"""

from app.models.category import Category
from app.models.home import Home
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.room import Room
from app.models.storage_location import StorageLocation
from app.models.tag import Tag
from app.models.user import User

__all__ = [
    "Category",
    "Home",
    "Item",
    "ItemImage",
    "Room",
    "StorageLocation",
    "Tag",
    "User",
]
