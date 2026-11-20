/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  /** AdMob 배너 광고 단위 ID. 없으면 테스트 광고. */
  readonly VITE_ADMOB_BANNER_ID?: string
  /** OTA 안내 파일 주소. 기본은 운영 웹 버전의 /ota/manifest.json. */
  readonly VITE_OTA_MANIFEST_URL?: string
}

// vite.config.ts 의 define 으로 빌드 때 채워진다.
declare const __APP_BUILD__: string
declare const __APP_BUILT_AT__: number

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
