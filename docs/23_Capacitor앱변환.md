# 23단계: Capacitor 앱 변환 (가이드)

> 집안의모든것(home-items) 프로젝트 · 작성일 2026-07-18

---

## 1. 이번 단계의 목표

웹 MVP 가 정상 동작한 이후, **Capacitor**로 Android/iOS 네이티브 앱으로 감싸는 방법을 안내합니다.

> ⚠️ 이 단계는 **가이드 문서**입니다.
> Android/iOS 빌드는 각각 Android Studio(SDK)·Xcode 가 설치된 환경에서 진행해야 하며,
> 현재 개발 PC 에서 네이티브 빌드를 검증하지 않았습니다.
> 웹 MVP 를 브라우저에서 충분히 확인한 뒤 진행하세요.

---

## 2. 사전 준비

- 웹 빌드가 정상(`npm run build` → `dist/`)
- Android: Android Studio + SDK
- iOS: macOS + Xcode + CocoaPods

---

## 3. Capacitor 설치 및 초기화

```bash
cd home-items-app

# 코어/CLI + 플러그인
npm install @capacitor/core @capacitor/cli
npm install @capacitor/camera @capacitor/status-bar

# 초기화 (앱 이름 / 번들 ID)
npx cap init "집안의모든것" com.homeitems.app --web-dir=dist
```

### capacitor.config.ts 예시
```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.homeitems.app',
  appName: '집안의모든것',
  webDir: 'dist',
  server: {
    // 개발 시 실기기에서 로컬 백엔드에 접속하려면 PC 의 LAN IP 사용
    // cleartext: true,
    // url: 'http://192.168.0.10:5173',
  },
}

export default config
```

---

## 4. 플랫폼 추가 및 실행

```bash
npm run build                 # 먼저 웹 빌드

npx cap add android
npx cap add ios

# 웹 빌드 결과를 네이티브 프로젝트로 복사/동기화
npx cap sync

# IDE 로 열기
npx cap open android          # Android Studio
npx cap open ios              # Xcode
```

`android/`, `ios/` 폴더는 `.gitignore`에 이미 제외되어 있습니다(재생성 가능).

---

## 5. 카메라/사진 (선택 플러그인)

`@capacitor/camera`로 카메라 촬영·갤러리 선택을 물건 등록 화면에 결합할 수 있습니다.

```ts
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

async function pickPhoto() {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt, // 카메라/갤러리 선택
    quality: 80,
  })
  // photo.webPath 로 미리보기 → fetch 후 File 로 변환하여 업로드
}
```

권한:
- Android: `AndroidManifest.xml`에 카메라/저장소 권한
- iOS: `Info.plist`에 `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`

---

## 6. API 서버 주소(환경별)

| 환경 | VITE_API_BASE_URL |
|------|-------------------|
| 웹 개발 | `http://localhost:8000/api/v1` |
| 실기기(개발) | `http://<PC LAN IP>:8000/api/v1` (백엔드 CORS 에 해당 출처 추가) |
| 운영 | `https://api.도메인/api/v1` |

빌드 시 `.env` 의 `VITE_API_BASE_URL` 값이 번들에 포함되므로 환경별로 빌드하세요.

---

## 7. 모바일 빌드 요약

```bash
# 코드 변경 후 반복
npm run build && npx cap sync

# Android: Android Studio 에서 Run / APK·AAB 빌드
# iOS: Xcode 에서 Run / Archive
```

---

## 8. 완료 결과 (가이드)

웹 MVP 를 그대로 재사용해 Android/iOS 앱으로 확장하는 절차를 정리했습니다.
실제 네이티브 빌드는 각 플랫폼 도구가 준비된 환경에서 위 절차대로 진행하면 됩니다.

### 추천 커밋 메시지
```text
docs: add Capacitor mobile conversion guide
```
