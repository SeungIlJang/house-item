import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.homeitems.app',
  appName: '집안의모든것',
  webDir: 'dist',
  server: {
    // 운영: 백엔드가 https 이므로 https 스킴 사용(cleartext 불필요)
    androidScheme: 'https',
  },
  plugins: {
    // OTA 업데이트(src/services/ota.ts). Capgo 클라우드를 쓰지 않고 앱이 직접 확인·다운로드한다.
    CapacitorUpdater: {
      autoUpdate: false, // 자동(클라우드) 업데이트 끔: 우리 서버의 manifest 를 직접 확인한다
      statsUrl: '', // 외부로 통계를 보내지 않는다
      resetWhenUpdate: true, // 스토어로 앱이 업데이트되면 내려받은 묶음을 버리고 새 내장 묶음을 쓴다
      autoDeleteFailed: true,
      autoDeletePrevious: true,
    },
  },
}

export default config
