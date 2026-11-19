# 집안의모든것 (home-items)

집 안의 물건을 등록하고 **어느 방, 어느 수납공간**에 보관되어 있는지 기록해
나중에 쉽게 찾을 수 있는 모바일 앱입니다.

> 예) 여권은 안방 붙박이장 두 번째 서랍 · 드라이버는 베란다 공구함 안

---

## 프로젝트 구성

```text
house-item/
├── worker/           # 백엔드 API (Cloudflare Workers + Hono, D1, R2)
├── home-items-app/   # 앱 (Ionic Vue + Capacitor, Android · PWA)
└── docs/             # 개발 기록과 운영 문서
```

## 기술 스택과 비용

| 영역 | 사용 | 무료 한도(요약) |
|------|------|-----------------|
| 앱 | Vue 3, Ionic 8, Capacitor 6, Pinia, Vite | - |
| API | Cloudflare Workers + Hono (TypeScript) | 하루 10만 요청 |
| DB | Cloudflare D1 (SQLite 호환) | 5GB |
| 사진 | Cloudflare R2 | 10GB, 전송료 없음 |
| 로그인 | 구글 · 카카오 OAuth (PKCE) + 자체 JWT | - |

사용자가 적은 동안에는 비용이 들지 않습니다. 한도 수치는 Cloudflare 요금 페이지에서 최신 값을 확인하세요.
사진은 업로드 전에 앱에서 긴 변 1600px JPEG 로 줄여 장당 300KB 안팎으로 저장합니다.

> 이전에는 FastAPI + PostgreSQL(Render) 백엔드를 썼습니다. 그 코드는 삭제했고 git 기록(`2732d1f` 이전)에 남아 있습니다.
> `docs/03~13`, `docs/21` 은 그 시절의 개발 기록입니다.

---

## 요구 사항

| 도구 | 버전 | 비고 |
|------|------|------|
| Node.js | **22 이상** | Wrangler 4 와 Worker 테스트가 Node 22 를 요구합니다 |
| Cloudflare 계정 | 무료 | 배포할 때만 필요 |
| Android Studio | 최신 | 안드로이드 앱 빌드할 때만 필요 |

nvm-windows 를 쓴다면 `nvm use 22.18.0` 처럼 먼저 전환합니다.

---

## 빠른 시작 (로컬 개발)

### 1) 백엔드 (Worker)

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # JWT_SECRET_KEY 등 채우기
npm run db:local                 # 로컬 D1 에 테이블 생성
npm run dev                      # http://localhost:8787
```

### 2) 앱 (브라우저)

```bash
cd home-items-app
npm install
npm run dev                      # http://localhost:5173 (API 는 자동으로 localhost:8787)
```

로그인은 소셜 전용이라, 로컬에서 로그인까지 시험하려면 `.dev.vars` 에 구글·카카오 키가 필요합니다.
자세한 절차는 [docs/실행방법.md](docs/실행방법.md), [docs/소셜로그인.md](docs/소셜로그인.md) 를 참고하세요.

---

## 검사 / 테스트

```bash
# 백엔드
cd worker
npm run check        # 타입 검사
npm test             # 실제 SQLite 로 API 동작 검증

# 앱
cd home-items-app
npm run type-check
npm run lint
npm test
npm run build
```

---

## 배포

```bash
cd worker
npm run db:remote    # 마이그레이션이 추가됐을 때만
npm run deploy
```

비밀값은 `npx wrangler secret put <이름>` 으로 넣습니다.
`JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, (선택) `KAKAO_ADMIN_KEY`.

운영 절차와 백업은 [docs/Cloudflare배포.md](docs/Cloudflare배포.md), 안드로이드 빌드는 [docs/안드로이드실행.md](docs/안드로이드실행.md) 참고.

---

## 주요 API (`/api/v1`)

```text
GET    /auth/{google|kakao}/start      소셜 로그인 시작 (브라우저로 열기)
GET    /auth/{google|kakao}/callback   제공자 콜백 → 앱 딥링크로 토큰 전달
GET    /users/me                       내 정보
DELETE /users/me                       회원 탈퇴 (모든 데이터·사진 삭제)

GET/POST/PUT/DELETE  /homes[/{id}]                 집 (삭제 시 물건·사진도 삭제)
GET/POST             /homes/{id}/rooms             방 목록/생성
GET/PUT/DELETE       /rooms/{id}                   방
GET/POST             /rooms/{id}/storage-locations 수납공간 트리/생성
GET/PUT/DELETE       /storage-locations/{id}       수납공간 (계층, 순환 지정 불가)

GET/POST/PUT/DELETE  /categories[/{id}]            카테고리
GET/POST/PUT/DELETE  /tags[/{id}]                  태그

GET/POST/PUT/DELETE  /items[/{id}]                 물건
GET    /items/search   keyword, home_id, room_id, storage_location_id, category_id, tag_id,
                       expires_before(YYYY-MM-DD, 이 날짜 이전 만료), sort(recent|name|expiration), page, size
POST   /items/{id}/images              사진 업로드 (multipart, jpg/png/webp/gif/heic, 10MB 이하)
DELETE /items/{id}/images/{imageId}
```

응답은 공통 래퍼 `{ success, data, message, errorCode? }`, 필드는 camelCase 입니다.
잘못된 입력은 400/404/422 와 한국어 메시지로 응답합니다.

---

## 화면 구성

하단 탭: **홈 · 찾기 · 등록 · 보관 장소 · 내 정보**
- 홈: 전체 물건 수, 유통기한 임박 물건, 최근 물건
- 찾기: 키워드 + 카테고리 필터, 물건 상세/수정/삭제
- 보관 장소: 집 → 방 → 수납공간 트리
- 내 정보: 카테고리·태그 관리, 유통기한 알림 설정, 로그아웃, 회원 탈퇴

---

## 유통기한 알림

서버 없이 기기의 로컬 알림(`@capacitor/local-notifications`)으로 동작합니다. 앱에서만 울리고 웹(PWA)에서는 홈 화면의
"유통기한 임박" 목록만 보입니다. 홈 진입·물건 저장·삭제 때 앞으로 60일 안에 만료되는 물건으로 알림을 다시 예약하며
(가까운 50개까지), 기본값은 만료 3일 전 오전 9시입니다. 플러그인을 추가했으므로 안드로이드 빌드 전에 `npx cap sync android` 가 필요합니다.

## 알려진 제한사항

- 집은 한 사용자 소유입니다 (가족 공유 미지원).
- 사진 주소가 `r2.dev` 공개 URL 입니다. 도메인이 생기면 R2 커스텀 도메인으로 옮기는 것을 권장합니다.
- `home-items-app/android/` 는 git 에서 제외되어 있어 네이티브 설정(딥링크, 서명)은 각 PC 에만 있습니다.
- 검색은 SQL `LIKE` 기반입니다.

## 라이선스

Private (개인 프로젝트)
