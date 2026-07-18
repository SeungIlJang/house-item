import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.homeitems.app',
  appName: '집안의모든것',
  webDir: 'dist',
  server: {
    // 개발 PC 의 HTTP 백엔드(LAN)에 접속하기 위해 http 스킴 + cleartext 허용
    androidScheme: 'http',
    cleartext: true,
  },
}

export default config
