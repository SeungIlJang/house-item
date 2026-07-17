# 20단계: 반응형 UI와 PWA

> 집안의모든것(home-items) 프로젝트 · 작성일 2026-07-18

---

## 1. 이번 단계의 목표

- 모바일/데스크톱 반응형 확인
- PWA 설정(홈 화면 설치, 앱 아이콘)
- 네트워크 오류 처리

---

## 2. 설계 설명

| 구성 | 내용 |
|------|------|
| 반응형 | Ionic 컴포넌트가 기본적으로 모바일 우선 + 반응형. `viewport-fit=cover`로 Safe Area 대응 |
| PWA | `vite-plugin-pwa`(Workbox)로 서비스워커·매니페스트 자동 생성, `autoUpdate` |
| 아이콘 | 192/512(maskable 포함) PNG, apple-touch-icon, favicon |
| 캐시 정책 | 앱 셸만 프리캐시. `/api`, `/uploads`는 내비게이션 폴백에서 제외(항상 네트워크) |
| 오류 처리 | Axios 인터셉터(401 → 로그인), 각 페이지 try/catch → 토스트 |

---

## 3. 생성 / 수정한 파일

```text
생성
- public/pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png, favicon.png
수정
- vite.config.ts        # VitePWA 플러그인 + manifest + workbox
- index.html            # theme-color, apple-touch-icon, iOS 웹앱 메타
- package.json          # vite-plugin-pwa 추가
```

---

## 4. 실행과 테스트 결과

```bash
npm run type-check   # 통과
npm run lint         # 통과
npm run build        # 성공
```
- 빌드 산출물: `dist/sw.js`, `dist/manifest.webmanifest`, `dist/registerSW.js`, `dist/workbox-*.js`
- PWA precache 46 entries 생성 확인 ✅
- 설치: 빌드 후 `npm run preview` → 브라우저에서 "홈 화면에 추가"로 설치 가능

> 참고: 서비스워커는 개발(`npm run dev`)보다 `npm run preview`(프로덕션 빌드)에서 정확히 동작합니다.

---

## 5. 완료 결과

앱을 홈 화면에 설치할 수 있고, 아이콘·테마·Safe Area 가 적용됩니다. API/이미지 요청은 항상 네트워크를 사용합니다.

### 추천 커밋 메시지
```text
feat: add PWA support (manifest, service worker, icons)
```

---

## 6. 다음 단계 안내

**21단계: Docker 통합** — 백엔드/프론트 Dockerfile, docker-compose 통합, 한 번에 실행.
