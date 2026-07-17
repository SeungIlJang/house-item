"""사용자 라우터: 현재 사용자 조회."""

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.schemas.common import ApiResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def get_me(current_user: CurrentUser) -> ApiResponse[UserResponse]:
    return ApiResponse(data=UserResponse.model_validate(current_user))
