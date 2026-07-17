# 5단계: SQLAlchemy와 Alembic 구성

> 집안의모든것(home-items) 프로젝트 · 작성일 2026-07-17

---

## 1. 이번 단계의 목표

- 모든 데이터베이스 모델의 **기반 클래스(Base)** 정의
- 모든 테이블이 공유할 **공통 시간 컬럼**(created_at / updated_at) 믹스인
- DB 구조 변경을 코드로 관리하는 **Alembic(마이그레이션 도구)** 초기화
- **첫 마이그레이션(빈 기준선)** 생성 및 실행으로 파이프라인 검증

> 이번 단계에는 아직 실제 도메인 테이블이 없습니다(모델은 6단계 User부터).
> 목적은 "Alembic ↔ DB 연결이 제대로 동작하는가"를 확인하는 것입니다.

---

## 2. 설계 설명

| 구성 | 선택 / 이유 |
|------|-------------|
| `Base` (DeclarativeBase) | SQLAlchemy 2.x 스타일. 모든 모델의 부모 |
| `TimestampMixin` | created_at/updated_at 을 공통 제공 → 중복 제거 |
| 시각 컬럼 | `timezone=True` + `server_default=now()` , updated_at 은 `onupdate=now()` |
| Alembic URL 주입 | `alembic.ini`에 비밀번호를 두지 않고 `env.py`에서 `.env`(settings) 값 주입 |
| autogenerate | `Base.metadata` 를 대상으로 모델→마이그레이션 자동 생성 |
| ruff 제외 | `alembic/`는 도구가 생성하는 보일러플레이트라 린트 대상에서 제외 |

> 용어 한 줄 설명
> - **마이그레이션**: DB 스키마 변경을 파일로 기록·적용하는 것. 협업/배포 시 안전하게 동기화.
> - **믹스인(Mixin)**: 여러 클래스에 공통 기능을 끼워 넣는 작은 클래스.
> - **autogenerate**: 모델과 실제 DB를 비교해 변경 마이그레이션을 자동 생성하는 기능.

---

## 3. 생성 / 수정한 파일

```text
생성
- app/database/base.py                         # Base + TimestampMixin
- alembic/                                     # alembic init 결과
  ├── env.py                                   # (수정) settings/Base 연결
  ├── script.py.mako
  ├── README
  └── versions/1054e825a2b6_init_baseline.py   # 첫 마이그레이션(빈 기준선)
- alembic.ini                                  # alembic init 결과

수정
- alembic/env.py                               # DATABASE_URL 주입 + target_metadata=Base.metadata
- pyproject.toml                               # ruff extend-exclude=["alembic"]
```

### env.py 핵심 변경
```python
from app.core.config import settings
from app.database.base import Base
import app.models  # noqa: F401  (모델 등록용)

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata
```

---

## 4. 실행 명령어

```bash
cd home-items-api

# Alembic 초기화 (최초 1회)
uv run alembic init alembic

# 마이그레이션 생성 (모델 변경 시마다)
uv run alembic revision --autogenerate -m "메시지"

# 마이그레이션 적용
uv run alembic upgrade head

# 되돌리기 / 현재 상태
uv run alembic downgrade -1
uv run alembic current
```

---

## 5. 실행과 테스트 결과

- `alembic init alembic` : alembic 디렉터리·설정 생성 ✅
- `alembic revision --autogenerate -m "init baseline"` : 빈 기준선 리비전 `1054e825a2b6` 생성 ✅
- `alembic upgrade head` : `Running upgrade -> 1054e825a2b6, init baseline` ✅
- `alembic current` : `1054e825a2b6 (head)` ✅
- DB 확인 : `alembic_version` 테이블 생성됨, `version_num = 1054e825a2b6` ✅
- `ruff check` : **All checks passed!** (alembic 제외 설정 후)
- `ruff format --check` : 18 files already formatted
- `pytest` : **2 passed**

> 참고: IDE가 "패키지 미설치" 힌트를 표시할 수 있으나, 이는 IDE가 프로젝트 `.venv`가 아닌
> 다른 파이썬을 가리켜서 생기는 표시일 뿐이며 실제 설치(uv sync)와 무관합니다.

---

## 6. 완료 결과

- 모델 기반 클래스와 공통 시간 컬럼이 준비되었습니다.
- Alembic이 `.env`의 DB로 안전하게 연결되어 마이그레이션을 생성·적용합니다.
- 첫 기준선 마이그레이션이 적용되어, 이후 단계에서 테이블을 추가할 준비가 되었습니다.

### 추천 Git 커밋 메시지
```text
feat: set up SQLAlchemy Base/TimestampMixin and Alembic with baseline migration
```

---

## 7. 다음 단계 안내

**6단계: 사용자 인증**
- User 모델 (users 테이블) + 마이그레이션
- 회원가입 / 비밀번호 해시 / 로그인 / JWT 발급
- 현재 사용자 조회(get_current_user 의존성)
- 인증 테스트

계속하려면 **"다음"** 이라고 입력해주세요.
