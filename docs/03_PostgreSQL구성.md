# 3단계: 개발용 PostgreSQL 구성

> 집안의모든것(home-items) 프로젝트 · 작성일 2026-07-17

---

## 1. 이번 단계의 목표

물건 정보를 저장할 **데이터베이스(창고)**를 준비하는 단계입니다.
- 로컬 PostgreSQL에 **앱 전용 계정**과 **전용 데이터베이스** 생성
- `.env`에 연결 정보 설정
- 백엔드(SQLAlchemy)가 그 DB에 실제로 접속되는지 확인
- (Docker Compose는 배포용으로 형태만 준비, 개발 중 실행 안 함)

---

## 2. 설계 설명

| 결정 | 이유 |
|------|------|
| **전용 계정 `home_items` 생성** | 앱이 슈퍼유저(`seungiljang`)로 DB에 붙지 않도록. 권한을 자기 DB로 한정 → 보안·운영 유사성 |
| **전용 DB `home_items`** | 다른 프로젝트(`matzip-app` 등)와 데이터 격리 |
| **로컬 PostgreSQL 사용** | 요구사항대로 개발에는 Docker 미사용. 이미 5432에서 실행 중인 로컬 DB 활용 |
| **비밀번호는 개발용** | `.env`에만 두고 git 무시. 운영에서는 강력한 값으로 교체 |
| **드라이버 `psycopg`(v3)** | SQLAlchemy 2.x 권장 조합. URL 접두사 `postgresql+psycopg://` |

> 로컬 접속 특징: 이 PC의 PostgreSQL은 OS 계정 `seungiljang`이 **비밀번호 없는 슈퍼유저**입니다.
> 그래서 앱 전용 계정을 따로 만들어 사용합니다.

---

## 3. 생성 / 수정한 것

```text
DB 리소스 생성
- ROLE     home_items  (LOGIN, 개발용 비밀번호)
- DATABASE home_items  (OWNER = home_items)

수정
- .env.example        DATABASE_URL 을 전용 계정으로 변경
- .env                (.env.example 복사 후 사용, git 무시됨)

생성
- docker-compose.yml  (배포용 db 서비스 — 개발 중 실행 안 함)
- docs/03_PostgreSQL구성.md
```

### 연결 문자열
```text
DATABASE_URL=postgresql+psycopg://home_items:home_items_dev_pw@localhost:5432/home_items
```

---

## 4. 실행한 명령어

```bash
# 1) 전용 계정 생성 (없을 때만)
psql -d postgres -c "CREATE ROLE home_items LOGIN PASSWORD 'home_items_dev_pw';"

# 2) 전용 DB 생성 (소유자 = home_items)
psql -d postgres -c "CREATE DATABASE home_items OWNER home_items;"

# 3) .env 준비
cp .env.example .env

# 4) 직접 접속 테스트
PGPASSWORD=home_items_dev_pw psql -h localhost -U home_items -d home_items -c "SELECT current_user;"

# 5) SQLAlchemy 접속 테스트 (백엔드 폴더에서)
cd home-items-api
uv run python -c "from sqlalchemy import create_engine, text; ..."   # DATABASE_URL로 접속
```

---

## 5. 실행과 테스트 결과

- 전용 계정/DB 생성: `CREATE ROLE` / `CREATE DATABASE` 성공
- `\l home_items` : DB `home_items` (owner `home_items`, UTF8) 확인 ✅
- **직접 psql 접속**: `current_user=home_items`, `current_database=home_items`, PostgreSQL 14.15 ✅
- **SQLAlchemy(psycopg) 접속**: `('home_items', 'home_items')` 반환 → 백엔드에서 접속 성공 ✅

---

## 6. 완료 결과

- 앱 전용 계정과 데이터베이스가 준비되었습니다.
- `.env`의 `DATABASE_URL`로 백엔드가 DB에 정상 접속됩니다.
- 배포용 `docker-compose.yml`(db 서비스)을 형태만 준비했습니다(개발 중 미실행).

### 참고: 이 DB를 초기화하고 싶을 때
```bash
psql -d postgres -c "DROP DATABASE IF EXISTS home_items;"
psql -d postgres -c "CREATE DATABASE home_items OWNER home_items;"
```

---

## 7. 다음 단계 안내

**4단계: FastAPI 기본 구성**
- 설정 관리(`app/core/config.py`, pydantic-settings로 `.env` 로드)
- DB 세션(`app/database/session.py`)
- CORS 설정
- 공통 응답 구조 / 공통 예외 처리
- 상태 확인 API `GET /health` 정식화

계속하려면 **"다음"** 이라고 입력해주세요.
