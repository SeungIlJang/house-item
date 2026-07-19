"""애플리케이션 설정.

.env 파일의 값을 타입 안전하게 읽어옵니다.
비밀키·DB 접속 정보를 코드에 하드코딩하지 않기 위해 환경 변수로 관리합니다.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 실행 환경: development | production
    app_env: str = "development"

    # 데이터베이스 (필수)
    database_url: str

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        """배포 플랫폼(Render/Neon/Heroku 등)이 주는 URL 을 psycopg 드라이버로 통일.

        postgres:// 또는 postgresql:// → postgresql+psycopg://
        (이미 +psycopg 가 붙어 있으면 그대로 둔다)
        """
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://") :]
        if value.startswith("postgresql://"):
            value = "postgresql+psycopg://" + value[len("postgresql://") :]
        return value

    # JWT
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    # '로그인 유지' 선택 시 사용하는 장기 만료(기본 30일)
    remember_token_expire_minutes: int = 60 * 24 * 30

    # CORS 허용 출처 (쉼표로 구분한 문자열)
    cors_origins: str = "http://localhost:5173"

    # 이미지 저장 방식: local | s3
    storage_backend: str = "local"

    # 로컬 이미지 업로드 경로 (storage_backend=local)
    upload_dir: str = "uploads"

    # S3/R2 설정 (storage_backend=s3). Cloudflare R2 도 S3 호환.
    s3_endpoint_url: str = ""  # 예: https://<account>.r2.cloudflarestorage.com
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket: str = ""
    s3_region: str = "auto"
    s3_public_base_url: str = ""  # 공개 접근 URL 예: https://pub-xxxx.r2.dev

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
