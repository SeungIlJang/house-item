# 21단계: Docker 통합

> 집안의모든것(home-items) 프로젝트 · 작성일 2026-07-18

---

## 1. 이번 단계의 목표

- 백엔드/프론트 Dockerfile
- PostgreSQL 포함 docker-compose 통합
- 한 번에 전체 실행

> 개발 중에는 로컬 PostgreSQL + uv/npm 을 사용합니다.
> 이 단계 산출물은 **배포 또는 전체 통합 실행**용입니다. (현 개발 PC 에 Docker 미설치)

---

## 2. 설계 설명

| 구성 | 내용 |
|------|------|
| 백엔드 이미지 | `python:3.13-slim` + uv, `uv sync --frozen --no-dev`, 시작 시 `alembic upgrade` 후 uvicorn |
| 프론트 이미지 | 멀티스테이지: `node:20-alpine`로 빌드 → `nginx:alpine`로 정적 서빙 |
| 오리진 통합 | nginx 가 `/api`·`/uploads`를 백엔드로 프록시 → 프론트는 `VITE_API_BASE_URL=/api/v1` |
| DB | `postgres:16-alpine`, 볼륨 영속화, healthcheck |
| 업로드 | `home_items_uploads` 볼륨으로 이미지 영속화 |
| 비밀값 | JWT/DB 비밀번호는 환경 변수로 주입(운영은 강력한 값으로) |

---

## 3. 생성 / 수정한 파일

```text
생성
- home-items-api/Dockerfile, .dockerignore
- home-items-app/Dockerfile, .dockerignore, nginx.conf
수정
- docker-compose.yml   # db + api + app 통합
```

---

## 4. 실행 방법 (배포/전체 실행)

```bash
# 저장소 루트에서
docker compose up --build

# 접속
#   프론트: http://localhost:8080
#   백엔드(직접): http://localhost:8000/docs
```

환경 변수(선택, 루트 `.env` 또는 셸):
```text
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
JWT_SECRET_KEY, CORS_ORIGINS, DB_PORT
```

---

## 5. 검증 결과

- 현 PC 에 Docker 미설치 → 이미지 빌드는 배포 시점에 수행.
- `docker-compose.yml` YAML 문법 검증 통과(services: db, api, app) ✅
- Dockerfile 은 표준 패턴(uv sync / 멀티스테이지 nginx)으로 작성.

> Docker 설치 후 검증:
> ```bash
> docker compose config      # 구성 검증
> docker compose up --build  # 전체 기동
> ```

---

## 6. 완료 결과

한 번의 명령으로 DB + 백엔드 + 프론트를 함께 실행할 수 있는 구성이 준비되었습니다.

### 추천 커밋 메시지
```text
chore: add Docker setup for backend, frontend, and compose
```

---

## 7. 다음 단계 안내

**22단계: 최종 테스트와 문서화** — 전체 기능 점검, README 보강, 알려진 제한사항 정리.
