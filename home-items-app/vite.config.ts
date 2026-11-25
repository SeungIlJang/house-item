import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// 웹 묶음의 버전과 빌드 시각. OTA 가 "지금 실행 중인 묶음보다 새 것인지" 비교하는 데 쓴다.
// OTA 배포(scripts/build-ota.mjs)는 값을 환경 변수로 넘기고, 일반 빌드는 여기서 만든다.
const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
const builtAt = Number(process.env.APP_BUILT_AT) || Date.now()
const buildId = process.env.APP_BUILD_ID || `${pkgVersion}-${new Date(builtAt).toISOString().replace(/[-:T]/g, '').slice(0, 14)}`

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify(buildId),
    __APP_BUILT_AT__: String(builtAt),
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // 서비스 워커 등록은 직접 한다(src/services/serviceWorker.ts): 웹에서만 등록하고 안드로이드 앱에서는 지운다.
      // 앱에서 서비스 워커가 돌면 예전 화면을 캐시에서 내줘 OTA 업데이트가 적용되지 않는다.
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: '집안의모든것',
        short_name: '집안의모든것',
        description: '집 안의 물건 보관 위치를 기록하고 검색하는 앱',
        theme_color: '#3880ff',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'ko',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 새 버전의 서비스 워커가 기다리지 않고 바로 넘겨받게 한다. injectRegister 를 끄면 플러그인이
        // 이 두 값을 자동으로 켜 주지 않아, 새 버전이 모든 탭을 닫을 때까지 적용되지 않는다.
        skipWaiting: true,
        clientsClaim: true,
        // 업로드 이미지/ API 응답은 캐시하지 않고, 정적 앱 셸만 캐시
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})
