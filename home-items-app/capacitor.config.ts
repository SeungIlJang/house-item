import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.homeitems.app',
  appName: '집안의모든것',
  webDir: 'dist',
  server: {
    // 운영: 백엔드가 https 이므로 https 스킴 사용(cleartext 불필요)
    androidScheme: 'https',
  },
}

export default config
