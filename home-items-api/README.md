# home-items-api (백엔드)

집안의모든것 백엔드 API. FastAPI + SQLAlchemy 2.x + PostgreSQL.

## 설치 및 실행

```bash
uv sync                                    # 의존성 설치
uv run uvicorn app.main:app --reload       # 개발 서버 (http://localhost:8000)
```

- API 문서(Swagger UI): http://localhost:8000/docs
- 상태 확인: http://localhost:8000/health

## 검사

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

## 계층 구조

```text
Router (app/api)  →  Service (app/services)  →  Repository (app/repositories)  →  DB
```

Router 에서 SQLAlchemy 를 직접 호출하지 않습니다.
