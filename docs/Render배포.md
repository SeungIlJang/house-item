# Render에 백엔드 배포하기 (단계별)

FastAPI 백엔드 + PostgreSQL 을 Render에 올려 **실제 https 주소**를 만듭니다.
저장소에 `render.yaml`(Blueprint)이 있어서 **거의 자동**으로 구성됩니다.

> 준비: R2 값 4개(ENDPOINT/KEY/SECRET/PUBLIC_URL, BUCKET) — 이미 발급 완료.

---

## 1. Render 가입
1. https://render.com → **Get Started** → **GitHub 로 로그인**
2. GitHub 권한 요청 시 저장소 접근 허용 (`SeungIlJang/house-item`)

---

## 2. Blueprint 로 한 번에 생성
1. 대시보드 → **New +** → **Blueprint**
2. 저장소 **house-item** 선택 → Render 가 `render.yaml` 을 읽어 구성 표시
   - 웹 서비스: `home-items-api` (Docker)
   - 데이터베이스: `home-items-db` (PostgreSQL, free)
3. **Apply** 클릭 → 생성 시작
   - `JWT_SECRET_KEY` 는 자동 생성됨
   - `DATABASE_URL` 은 DB에서 자동 연결됨

---

## 3. R2(이미지) 환경변수 입력
Blueprint 로 만들어지면 R2 비밀값만 직접 넣습니다.

1. `home-items-api` 서비스 → **Environment** 탭
2. 아래 값 입력(회원님 `.env` 값과 동일):
   ```text
   S3_ENDPOINT_URL      = https://1774d9ed400c1da063889c32e8c2c066.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID     = <R2 Access Key ID>
   S3_SECRET_ACCESS_KEY = <R2 Secret Access Key>
   S3_BUCKET            = home-items
   S3_PUBLIC_BASE_URL   = https://pub-fa27dec30c6241889d42241398b188fa.r2.dev
   ```
3. **Save Changes** → 서비스가 자동 재배포됩니다.

---

## 4. 배포 확인
1. 서비스 상단 상태가 **Live** 가 되면 완료 (첫 빌드는 몇 분 소요)
2. 서비스 주소 확인: `https://home-items-api-xxxx.onrender.com`
3. 브라우저에서 접속 테스트:
   - `https://home-items-api-xxxx.onrender.com/health` → `{"success":true,...}`
   - `https://home-items-api-xxxx.onrender.com/docs` → Swagger 문서
4. DB 테이블은 시작 시 `alembic upgrade head` 로 자동 생성됩니다.

> 무료 플랜은 15분 미사용 시 잠들고, 다음 요청에 30~50초 깨어납니다(개인용 OK).
> 무료 PostgreSQL 은 90일 후 만료됩니다 → 이후 유료 전환 또는 **Neon 무료 DB**로 이전 가능.

---

## 5. 앱을 운영 서버로 다시 빌드
백엔드 주소가 생겼으니, 앱이 그 주소를 보도록 다시 빌드합니다. (제가 도와드릴 수 있음)

1. `capacitor.config.ts` → 운영은 https 이므로:
   ```ts
   server: { androidScheme: 'https' } // cleartext 제거
   ```
2. 운영 API 주소로 빌드:
   ```bash
   cd home-items-app
   VITE_API_BASE_URL=https://home-items-api-xxxx.onrender.com/api/v1 npm run build
   npx cap sync android
   cd android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew assembleDebug
   ```
3. 폰에 설치 → 이제 **인터넷 어디서나**(WiFi/LTE 무관) 동작합니다.
   - CORS 는 `render.yaml` 에서 `https://localhost` 로 이미 허용됨(앱 웹뷰 출처).

---

## 6. 문제 해결
| 증상 | 해결 |
|------|------|
| 빌드 실패(Docker) | 로그 확인. 대부분 파이썬 의존성/네트워크 일시 오류 → Retry |
| `/health/db` 오류 | DATABASE_URL 연결 확인(Blueprint 가 자동 연결) |
| 이미지 업로드 500 | R2 5개 환경변수 오타 확인 |
| CORS 오류 | `CORS_ORIGINS` 에 앱/웹 출처 포함 확인 |
| 앱에서 접속 안 됨 | 앱을 운영 주소로 다시 빌드했는지 확인(5번) |

---

## 요약
1. Render 가입 → **Blueprint 로 house-item 연결 → Apply**
2. **R2 환경변수 5개** 입력 → Save
3. `.../health` 200 확인 → 서비스 주소 확보
4. 그 주소로 **앱 다시 빌드** → 어디서나 동작

배포 후 주소(`https://...onrender.com`)를 알려주시면, 앱을 그 주소로 다시 빌드/설치해 드리겠습니다.
