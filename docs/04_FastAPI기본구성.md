# 4단계: FastAPI 기본 구성

> 집안의모든것(home-items) 프로젝트 · 작성일 2026-07-17

---

## 1. 이번 단계의 목표

백엔드의 **뼈대와 공통 규칙**을 세웁니다.
- 설정 관리(`.env` 자동 로드), DB 세션 준비, CORS
- 모든 API가 같은 모양으로 응답하는 **공통 응답 구조**(camelCase)
- 오류를 일관되게 처리하는 **공통 예외 처리**
- 상태 확인 API `/health`, `/health/db` 정식화

---

## 2. 설계 설명

| 구성 | 선택 / 이유 |
|------|-------------|
| 설정 관리 | `pydantic-settings` 로 `.env`를 타입 안전하게 로드. 비밀키·DB 정보를 코드에 하드코딩하지 않음 |
| 공통 응답 | `success/data/message` 래퍼. 프론트가 항상 같은 형태로 처리 |
| 필드 표기 | 파이썬은 snake_case, JSON은 **camelCase** (`to_camel` alias) |
| 페이지네이션 | `PageData`(content/page/size/totalElements/totalPages) 제네릭 |
| 예외 처리 | `AppError` 계열 + FastAPI 핸들러. **운영에서는 상세 오류 숨김**, 개발에서는 원인 노출 |
| DB 세션 | 요청마다 세션 1개 열고 닫는 `get_db` 의존성. `pool_pre_ping`으로 끊긴 연결 자동 복구 |
| 제네릭 문법 | Python 3.13 PEP 695 (`class ApiResponse[T]`) 사용 |

> 용어 한 줄 설명
> - **CORS**: 다른 주소(예: 프론트 5173)에서 API(8000) 호출을 허용하는 브라우저 보안 규칙.
> - **의존성(dependency)**: 라우터 실행 전에 필요한 값을 주입하는 FastAPI 장치(예: DB 세션).

---

## 3. 생성 / 수정한 파일

```text
생성
- app/core/config.py         # 설정 (.env 로드)
- app/core/exceptions.py     # 공통 예외 + 핸들러
- app/schemas/common.py      # 공통 응답/페이지 스키마 (camelCase)
- app/database/session.py    # 엔진 + 세션 + get_db
- tests/test_health.py       # /health, /health/db 테스트

수정
- app/main.py                # CORS, 예외 핸들러 등록, /health, /health/db
```

---

## 4. 실행 명령어

```bash
cd home-items-api

# 검사
uv run ruff check .
uv run ruff format --check .

# 테스트
uv run pytest -q

# 서버 실행 (개발)
uv run uvicorn app.main:app --reload
#  → http://localhost:8000/health
#  → http://localhost:8000/health/db
#  → http://localhost:8000/docs  (Swagger UI)
```

---

## 5. 실행과 테스트 결과

- `ruff check` : **All checks passed!**
  - 초기 3건(UP043/UP046) 지적 → PEP 695 제네릭 문법으로 수정 후 통과
- `ruff format --check` : 17 files already formatted
- `pytest` : **2 passed** (`test_health`, `test_health_db`)
- 응답 형식 확인
  - `/health` → `{"success": true, "data": {"status":"ok","env":"development"}, "message": null}`
  - `/health/db` → `{"success": true, "data": {"database":"ok"}, ...}` (실제 DB 연결 성공)
  - `PageData` 직렬화 → `totalElements`, `totalPages` (camelCase) ✅
  - 404 → `{"success": false, "data": null, "message": "Not Found", "errorCode": "HTTP_ERROR"}` ✅

> 참고: `StarletteDeprecationWarning`(testclient/httpx) 경고는 동작에 영향 없음.

---

## 6. 완료 결과

- `.env` 기반 설정, DB 세션, CORS가 준비되었습니다.
- 성공/오류/페이지 응답이 모두 통일된 형식(camelCase)으로 나갑니다.
- 예외가 일관되게 처리되며, 운영/개발 환경에 따라 오류 노출 수준이 달라집니다.
- `/health`, `/health/db`로 서버·DB 상태를 확인할 수 있습니다.

### 추천 Git 커밋 메시지
```text
feat: add FastAPI base setup (config, db session, CORS, common response/error, health)
```

---

## 7. 다음 단계 안내

**5단계: SQLAlchemy와 Alembic 구성**
- SQLAlchemy `Base` 정의
- 공통 시간 컬럼(created_at/updated_at) 믹스인
- Alembic 초기화 및 첫 마이그레이션
- 마이그레이션 실행 확인

계속하려면 **"다음"** 이라고 입력해주세요.
