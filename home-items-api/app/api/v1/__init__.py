"""v1 API 라우터 집합."""

from fastapi import APIRouter

from app.api.v1 import (
    auth_router,
    category_router,
    home_router,
    item_router,
    room_router,
    storage_router,
    tag_router,
    user_router,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router.router)
api_router.include_router(user_router.router)
api_router.include_router(home_router.router)
api_router.include_router(room_router.router)
api_router.include_router(storage_router.room_router)
api_router.include_router(storage_router.storage_router)
api_router.include_router(category_router.router)
api_router.include_router(tag_router.router)
api_router.include_router(item_router.router)
