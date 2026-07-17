"""애플리케이션 설정.

.env 파일의 값을 타입 안전하게 읽어옵니다.
비밀키·DB 접속 정보를 코드에 하드코딩하지 않기 위해 환경 변수로 관리합니다.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 실행 환경: development | production
    app_env: str = "development"

    # 데이터베이스 (필수)
    database_url: str

    # JWT
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # CORS 허용 출처 (쉼표로 구분한 문자열)
    cors_origins: str = "http://localhost:5173"

    # 이미지 업로드 경로
    upload_dir: str = "uploads"

    # .env 는 저장소 루트(../.env) 또는 현재 폴더(.env)에서 찾습니다.
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()  # type: ignore[call-arg]
