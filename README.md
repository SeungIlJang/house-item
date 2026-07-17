# 집안의모든것 (home-items)

집 안의 물건을 등록하고 **어느 방, 어느 수납공간**에 보관되어 있는지 기록해
나중에 쉽게 찾을 수 있는 웹·모바일 서비스입니다.

> 예) 여권은 안방 붙박이장 두 번째 서랍 · 드라이버는 베란다 공구함 안

---

## 프로젝트 구성 (모노레포)

```text
house-items/
├── home-items-api/   # 백엔드 (FastAPI, SQLAlchemy, PostgreSQL)
├── home-items-app/   # 프론트 (Ionic Vue) — 14단계에서 생성
├── docs/             # 단계별 개발 기록
├── .env.example
├── .gitignore
└── README.md
```

## 기술 스택

- **Frontend**: TypeScript, Vue 3, Ionic Vue, Vite, Pinia, Vue Router, Axios, Capacitor(PWA)
- **Backend**: Python, FastAPI, Pydantic, SQLAlchemy 2.x, Alembic, PostgreSQL, JWT, uv, pytest
- **Dev**: Git, .env, REST API, OpenAPI/Swagger UI (Docker는 배포 시점에만)

## 개발 환경 요구사항

| 도구 | 버전(현재 확인값) |
|------|------|
| Python | 3.13+ |
| uv | 0.9+ |
| Node.js | 20 LTS 권장 (현재 18) |
| PostgreSQL | 14+ (로컬 5432) |

## 빠른 시작 (백엔드) — 이후 단계에서 채워집니다

```bash
cp .env.example .env      # 환경 변수 설정
cd home-items-api
uv sync                   # 의존성 설치
uv run uvicorn app.main:app --reload   # 서버 실행 → http://localhost:8000
```

## 개발 기록

단계별 진행 내용은 [`docs/`](docs/) 폴더를 참고하세요.

- [0단계: 개발 환경 확인](docs/00_개발환경확인.md)
- [1단계: 전체 설계](docs/01_전체설계.md)
- [2단계: 프로젝트 초기화](docs/02_프로젝트초기화.md)

## 라이선스

Private (개인 프로젝트)
