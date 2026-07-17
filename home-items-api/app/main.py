"""집안의모든것 백엔드 진입점.

FastAPI 앱을 만들고 CORS, 공통 예외 처리, 상태 확인 API를 구성합니다.
도메인 라우터(auth/home/room/...)는 이후 단계에서 추가합니다.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.v1 import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.database.session import engine
from app.schemas.common import success_response

app = FastAPI(title="home-items API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app, is_production=settings.is_production)

app.include_router(api_router)

# 업로드된 이미지를 정적 파일로 제공 (/uploads/...)
_upload_path = Path(settings.upload_dir)
_upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_upload_path)), name="uploads")


@app.get("/health")
def health() -> dict:
    """서버 생존 확인 (인증 불필요)."""
    return success_response({"status": "ok", "env": settings.app_env})


@app.get("/health/db")
def health_db() -> dict:
    """데이터베이스 연결 확인."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return success_response({"database": "ok"})
