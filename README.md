# 집안의모든것 (home-items)

집 안의 물건을 등록하고 **어느 방, 어느 수납공간**에 보관되어 있는지 기록해
나중에 쉽게 찾을 수 있는 웹·모바일 서비스입니다.

> 예) 여권은 안방 붙박이장 두 번째 서랍 · 드라이버는 베란다 공구함 안

---

## 프로젝트 구성 (모노레포)

```text
house-items/
├── home-items-api/   # 백엔드 (FastAPI, SQLAlchemy, PostgreSQL)
├── home-items-app/   # 프론트 (Ionic Vue, Vite, Pinia)
├── docs/             # 단계별 개발 기록 (0~23단계)
├── docker-compose.yml
├── .env.example
└── README.md
```

## 기술 스택

- **Frontend**: TypeScript, Vue 3, Ionic Vue 8, Vite 5, Pinia, Vue Router, Axios, PWA(vite-plugin-pwa)
- **Backend**: Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, PostgreSQL, JWT(python-jose), bcrypt, uv, pytest
- **Dev**: Git, .env, REST API, OpenAPI/Swagger UI. Docker 는 배포 시점 사용.

---

## 요구 사항

| 도구 | 버전 |
|------|------|
| Python | 3.13+ |
| uv | 0.9+ |
| Node.js | 18+ (20 LTS 권장) |
| PostgreSQL | 14+ |

---

## 빠른 시작 (로컬 개발)

### 1) 데이터베이스 준비 (로컬 PostgreSQL)
```bash
psql -d postgres -c "CREATE ROLE home_items LOGIN PASSWORD 'home_items_dev_pw';"
psql -d postgres -c "CREATE DATABASE home_items OWNER home_items;"
```

### 2) 환경 변수
```bash
cp .env.example .env
# JWT_SECRET_KEY 를 무작위 값으로 교체 권장:
#   python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 3) 백엔드
```bash
cd home-items-api
uv sync
uv run alembic upgrade head           # 테이블 생성
uv run uvicorn app.main:app --reload  # http://localhost:8000
# API 문서: http://localhost:8000/docs
```

### 4) 프론트
```bash
cd home-items-app
npm install
npm run dev                           # http://localhost:5173
```

---

## 검사 / 테스트

```bash
# 백엔드
cd home-items-api
uv run ruff check .
uv run ruff format --check .
uv run pytest              # 41 tests

# 프론트
cd home-items-app
npm run type-check
npm run lint
npm run build
```

---

## Docker 로 전체 실행 (배포/통합)

```bash
docker compose up --build
#   프론트: http://localhost:8080
#   백엔드: http://localhost:8000/docs
```

---

## 환경 변수 설명

| 변수 | 설명 |
|------|------|
| `APP_ENV` | `development` / `production` (운영은 상세 오류 숨김) |
| `DATABASE_URL` | `postgresql+psycopg://user:pw@host:5432/home_items` |
| `JWT_SECRET_KEY` | JWT 서명 비밀키 (운영은 반드시 교체) |
| `JWT_ALGORITHM` | 기본 `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 액세스 토큰 만료(분), 기본 60 |
| `CORS_ORIGINS` | 허용 출처(쉼표 구분) |
| `UPLOAD_DIR` | 이미지 업로드 경로 |
| `VITE_API_BASE_URL` | (프론트) API 기본 URL, 기본 `http://localhost:8000/api/v1` |

---

## 주요 API 목록 (`/api/v1`)

```text
POST   /auth/signup           회원가입
POST   /auth/login            로그인(JWT)
GET    /users/me              내 정보

GET/POST/PUT/DELETE  /homes[/{id}]              집
GET/POST             /homes/{id}/rooms          방 목록/생성
GET/PUT/DELETE       /rooms/{id}                방
GET/POST             /rooms/{id}/storage-locations   수납공간 트리/생성
GET/PUT/DELETE       /storage-locations/{id}    수납공간(계층)

GET/POST/PUT/DELETE  /categories[/{id}]         카테고리
GET/POST/PUT/DELETE  /tags[/{id}]               태그

GET/POST/PUT/DELETE  /items[/{id}]              물건
GET    /items/search          검색(keyword, home_id, room_id, storage_location_id, category_id, tag_id, sort, page, size)
POST   /items/{id}/images     이미지 업로드(multipart)
DELETE /items/{id}/images/{imageId}
```

응답은 공통 래퍼(`{ success, data, message, errorCode? }`), 필드는 camelCase.

---

## 화면 구성 (모바일 우선)

하단 탭: **홈 · 찾기 · 등록 · 보관 장소 · 내 정보**
- 홈 대시보드(전체 물건 수, 최근 물건, 빠른 등록/검색)
- 검색(키워드 + 카테고리 필터), 물건 상세/수정/삭제
- 보관 장소(집 → 방 → 수납공간 트리), 카테고리/태그 관리

---

## 알려진 제한사항 (MVP)

- Refresh Token 미적용(Access Token 만). 만료 시 재로그인.
- 이미지 저장은 로컬 파일 시스템(인터페이스 분리됨 → S3 교체 용이). `S3FileStorage`는 미구현 stub.
- ‘자주 찾은 물건’ 통계 미구현(최근 등록으로 대체).
- 검색은 PostgreSQL `ILIKE` 기반(전문 검색 엔진 미사용).
- 토큰은 localStorage 저장(XSS 대비는 운영 강화 시 httpOnly 쿠키 검토).
- 프론트 번들이 큼(Ionic 전체 번들) — 필요 시 코드 스플리팅으로 최적화 가능.
- Node 18(EOL)에서 개발됨 — 20 LTS 권장.

## 향후 확장(구조만 고려)

가족 공동관리, QR/바코드, 위치 변경 이력, 카메라 등록, OCR, AI 분석/자동분류,
자연어 검색, 푸시 알림, Android/iOS(Capacitor), PWA 오프라인.

---

## 개발 기록

단계별 상세는 [`docs/`](docs/) 참고. (0단계 환경확인 ~ 23단계 Capacitor)

## 라이선스

Private (개인 프로젝트)
