"""테스트 공통 설정.

실제 개발 DB를 건드리지 않도록, 테스트는 격리된 SQLite 인메모리 DB를 사용합니다.
get_db 의존성을 오버라이드해 테스트용 세션을 주입합니다.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (모든 모델 등록 → 테이블 생성)
from app.database.base import Base
from app.database.session import get_db
from app.main import app as fastapi_app


@pytest.fixture()
def db_session() -> Generator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite 는 기본적으로 외래키 제약이 꺼져 있어 ON DELETE CASCADE 가 동작하지 않는다.
    # 실제 PostgreSQL 과 동일하게 동작시키기 위해 연결마다 활성화한다.
    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_conn, _record) -> None:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    yield TestClient(fastapi_app)
    fastapi_app.dependency_overrides.clear()


def _register_and_login(client: TestClient, email: str, password: str = "password123") -> str:
    """회원가입 후 로그인해 access token 을 돌려준다."""
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "name": email.split("@")[0]},
    )
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return res.json()["data"]["accessToken"]


@pytest.fixture()
def auth_headers(client: TestClient) -> dict[str, str]:
    """기본 사용자(alice)로 인증된 헤더."""
    token = _register_and_login(client, "alice@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def other_headers(client: TestClient) -> dict[str, str]:
    """다른 사용자(bob) 헤더 — 소유권 검사 테스트용."""
    token = _register_and_login(client, "bob@example.com")
    return {"Authorization": f"Bearer {token}"}
