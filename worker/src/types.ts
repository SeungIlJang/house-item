import type { Hono } from 'hono'

export type Bindings = {
  DB: D1Database
  IMAGES: R2Bucket
  JWT_SECRET_KEY: string
  APP_ENV: string
  CORS_ORIGINS: string
  R2_PUBLIC_BASE_URL: string
  // 소셜 로그인. 값은 wrangler secret 으로 주입한다.
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  KAKAO_REST_API_KEY: string
  KAKAO_CLIENT_SECRET: string
  KAKAO_ADMIN_KEY?: string // 선택. 있으면 회원 탈퇴 시 카카오 앱 연결을 끊는다.
  APP_REDIRECT_URI: string // 예: com.homeitems.app://auth
}
export type Variables = { userId: number }
export type Row = Record<string, any>
export type AppEnv = { Bindings: Bindings; Variables: Variables }
export type App = Hono<AppEnv>
