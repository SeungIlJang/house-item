"""인증 라우터: 회원가입, 로그인."""

from fastapi import APIRouter, status

from app.api.dependencies import DbSession
from app.schemas.common import ApiResponse
from app.schemas.user import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: DbSession) -> ApiResponse[UserResponse]:
    user = AuthService(db).signup(
        email=payload.email,
        password=payload.password,
        name=payload.name,
    )
    return ApiResponse(data=UserResponse.model_validate(user), message="회원가입이 완료되었습니다.")


@router.post("/login")
def login(payload: LoginRequest, db: DbSession) -> ApiResponse[TokenResponse]:
    token, user = AuthService(db).login(email=payload.email, password=payload.password)
    data = TokenResponse(access_token=token, user=UserResponse.model_validate(user))
    return ApiResponse(data=data)
