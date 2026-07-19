"""사용자/인증 관련 요청·응답 스키마.

요청 스키마와 응답 스키마를 분리합니다.
비밀번호는 응답에 절대 포함하지 않습니다.
"""

from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.common import CamelModel


class SignupRequest(CamelModel):
    email: EmailStr
    # bcrypt 72바이트 제한을 고려해 최대 길이를 제한
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=100)


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
    remember_me: bool = True  # -> rememberMe (기본 유지)


class UserResponse(CamelModel):
    id: int
    email: EmailStr
    name: str
    created_at: datetime  # -> createdAt


class TokenResponse(CamelModel):
    access_token: str  # -> accessToken
    token_type: str = "bearer"  # -> tokenType
    user: UserResponse
