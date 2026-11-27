// 소셜 로그인(구글·카카오) 흐름.
//
// 구글은 임베디드 WebView 에서의 OAuth 를 차단한다(disallowed_useragent).
// 그래서 네이티브에서는 시스템 브라우저(Custom Tabs)로 열고,
// 서버가 발급한 토큰을 딥링크로 돌려받는다.
//
//   Browser.open(/auth/<provider>/start)
//     → 제공자 동의 → Worker 콜백 → com.homeitems.app://auth?token=...
//     → App 의 appUrlOpen 으로 수신
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { API_BASE_URL } from '@/api/client'
import { tr } from '@/i18n'

export type SocialProvider = 'google' | 'kakao'

export const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: 'Google',
  kakao: tr('카카오', 'Kakao'),
}

const ERROR_MESSAGE: Record<string, string> = {
  ACCESS_DENIED: tr('로그인이 취소되었습니다.', 'Sign-in was cancelled.'),
  INVALID_STATE: tr('로그인 요청이 만료되었습니다. 다시 시도해 주세요.', 'The sign-in request expired. Please try again.'),
  TOKEN_EXCHANGE_FAILED: tr('로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'Could not complete sign-in. Please try again shortly.'),
  PROVIDER_NOT_CONFIGURED: tr('아직 준비되지 않은 로그인 방식입니다.', 'This sign-in method is not available yet.'),
  LOGIN_FAILED: tr('로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'Sign-in failed. Please try again shortly.'),
}

// 제공자(카카오·구글)가 돌려준 오류 코드별 설명. 서버가 detail 로 넘겨준다.
const DETAIL_HINT: Record<string, string> = {
  KOE010: tr('카카오 앱 인증 정보(Client Secret)가 올바르지 않습니다.', 'The Kakao app credentials (Client Secret) are incorrect.'),
  KOE006: tr('카카오에 등록되지 않은 리다이렉트 URI 입니다.', 'This redirect URI is not registered with Kakao.'),
  KOE205: tr('카카오 동의항목 설정이 필요합니다.', 'Kakao consent items need to be configured.'),
  KOE320: tr('카카오 인가 코드가 만료되었거나 이미 사용되었습니다.', 'The Kakao authorization code expired or was already used.'),
  invalid_client: tr('앱 인증 정보(Client ID/Secret)가 올바르지 않습니다.', 'The app credentials (Client ID/Secret) are incorrect.'),
  redirect_uri_mismatch: tr('등록되지 않은 리다이렉트 URI 입니다.', 'This redirect URI is not registered.'),
}

export class SocialAuthError extends Error {
  readonly code: string
  readonly detail?: string
  constructor(code: string, detail?: string) {
    super(ERROR_MESSAGE[code] ?? tr('로그인에 실패했습니다.', 'Sign-in failed.'))
    this.code = code
    this.detail = detail
  }
}

/** 팝업에 보여 줄 오류 설명. 원인을 바로 알 수 있도록 오류 코드까지 붙인다. */
export function describeLoginError(error: unknown): { title: string; message: string } {
  if (error instanceof SocialAuthError) {
    const lines = [error.message]
    if (error.detail && DETAIL_HINT[error.detail]) lines.push(DETAIL_HINT[error.detail])
    lines.push('', `${tr('오류 코드', 'Error code')}: ${error.code}${error.detail ? ` (${error.detail})` : ''}`)
    return { title: tr('로그인 실패', 'Sign-in failed'), message: lines.join('\n') }
  }
  return { title: tr('로그인 실패', 'Sign-in failed'), message: error instanceof Error && error.message ? error.message : tr('로그인에 실패했습니다.', 'Sign-in failed.') }
}

const LOGIN_STATE_KEY = 'home_items_login_state'
// 웹 로그인 복귀 화면. 서버의 WEB_REDIRECT_URIS 에 "<웹 주소>/auth/callback" 이 등록돼 있어야 한다.
export const WEB_CALLBACK_PATH = '/auth/callback'
const currentOrigin = () => (typeof window === 'undefined' ? null : window.location.origin)

// 마지막으로 로그인에 성공한 방식. 로그아웃해도 남겨 두고, 다음 로그인 화면에서 그 버튼을 강조한다.
const LAST_PROVIDER_KEY = 'home_items_last_provider'

export function getLastProvider(): SocialProvider | null {
  const value = localStorage.getItem(LAST_PROVIDER_KEY)
  return value === 'google' || value === 'kakao' ? value : null
}

export function forgetLastProvider(): void {
  localStorage.removeItem(LAST_PROVIDER_KEY)
}

/**
 * 로그인이 끝까지 성공했을 때 호출한다. 시작할 때 저장해 둔 방식을 "최근 사용"으로 기억하고
 * 1회용 로그인 요청 정보는 지운다. (웹은 페이지를 떠났다 돌아오므로 시작 시점에 저장해 둔다)
 */
export function markLoginSucceeded(): void {
  try {
    const pending = JSON.parse(localStorage.getItem(LOGIN_STATE_KEY) || 'null')
    if (pending?.provider === 'google' || pending?.provider === 'kakao') {
      localStorage.setItem(LAST_PROVIDER_KEY, pending.provider)
    }
  } catch {
    // 기억하지 못해도 로그인에는 지장이 없다.
  }
  localStorage.removeItem(LOGIN_STATE_KEY)
}

const startUrl = (provider: SocialProvider) => {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, '0')).join('')
  localStorage.setItem(LOGIN_STATE_KEY, JSON.stringify({ state, provider, expiresAt: Date.now() + 600_000 }))
  const url = new URL(API_BASE_URL + '/auth/' + provider + '/start')
  url.searchParams.set('login_state', state)
  // 웹은 앱 딥링크로 돌아올 수 없으므로 이 사이트의 복귀 화면 주소를 알려 준다.
  if (!Capacitor.isNativePlatform()) url.searchParams.set('return_to', `${currentOrigin()}${WEB_CALLBACK_PATH}`)
  return url.toString()
}

/** 앱 딥링크(com.homeitems.app://auth) 또는 같은 사이트의 웹 복귀 화면만 로그인 결과로 인정한다. */
export function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'com.homeitems.app:') {
      return parsed.host === 'auth' && (parsed.pathname === '' || parsed.pathname === '/')
    }
    return parsed.origin === currentOrigin() && parsed.pathname === WEB_CALLBACK_PATH
  } catch {
    return false
  }
}

// appUrlOpen 리스너는 App.vue 에 하나만 둔다. signInWith() 는 대기자만 등록해 두고,
// 딥링크가 오면 App.vue 가 consumeCallbackUrl() 로 넘겨준다.
// (양쪽이 각자 리스너를 걸면 같은 딥링크를 두 번 처리하게 된다)
// eslint-disable-next-line no-unused-vars
let pendingHandler: ((url: string) => void) | null = null

/**
 * 대기 중인 signInWith() 에 콜백을 넘긴다.
 * 넘길 대상이 없으면(앱이 재시작된 경우 등) false 를 돌려주고, 호출한 쪽이 직접 처리한다.
 */
export function consumeCallbackUrl(url: string): boolean {
  const handler = pendingHandler
  if (!handler) return false
  pendingHandler = null
  handler(url)
  return true
}

/** 딥링크/리다이렉트 URL 에서 토큰을 꺼낸다. 실패면 SocialAuthError 를 던진다. */
export function readCallbackUrl(url: string): string {
  if (!isAuthCallbackUrl(url)) throw new SocialAuthError('LOGIN_FAILED')
  const parsed = new URL(url)
  // 커스텀 스킴(com.homeitems.app://auth?token=)은 search 가 비어있을 수 있어 hash 도 본다.
  const params = parsed.searchParams.size > 0
    ? parsed.searchParams
    : new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const pending = JSON.parse(localStorage.getItem(LOGIN_STATE_KEY) || 'null')
  if (!pending || pending.expiresAt < Date.now() || pending.state !== params.get('state')) {
    throw new SocialAuthError('INVALID_STATE')
  }
  const error = params.get('error')
  if (error) throw new SocialAuthError(error, params.get('detail') ?? undefined)
  const token = params.get('token')
  if (!token) throw new SocialAuthError('LOGIN_FAILED')
  return token
}

/**
 * 소셜 로그인을 시작하고 서버가 발급한 JWT 를 돌려준다.
 * 웹에서는 현재 탭이 제공자로 이동하므로 이 함수는 끝나지 않는다(복귀 시 재진입).
 */
export async function signInWith(provider: SocialProvider): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    window.location.href = startUrl(provider)
    // 페이지를 떠나므로 resolve 되지 않는다.
    return new Promise<string>(() => {})
  }

  const closeListener = await Browser.addListener('browserFinished', () => handleCancel())

  // TypeScript 함수 타입의 매개변수를 core ESLint가 값 변수로 오인한다.
  // eslint-disable-next-line no-unused-vars
  let settle: ((token: string) => void) | null = null
  // eslint-disable-next-line no-unused-vars
  let failWith: ((error: unknown) => void) | null = null

  const cleanup = async () => {
    settle = null
    failWith = null
    if (pendingHandler === handleUrl) pendingHandler = null
    await closeListener.remove()
  }

  function handleUrl(url: string) {
    if (!isAuthCallbackUrl(url)) return
    if (!settle || !failWith) return
    const resolveFn = settle
    const rejectFn = failWith
    void cleanup()
    void Browser.close().catch(() => undefined)
    try {
      resolveFn(readCallbackUrl(url))
    } catch (error) {
      rejectFn(error)
    }
  }

  // 브라우저를 그냥 닫은 경우. 딥링크가 먼저 오면 이미 cleanup 되어 무시된다.
  function handleCancel() {
    if (!failWith) return
    const rejectFn = failWith
    void cleanup()
    rejectFn(new SocialAuthError('ACCESS_DENIED'))
  }

  const result = new Promise<string>((resolve, reject) => {
    settle = resolve
    failWith = reject
  })
  pendingHandler = handleUrl

  try {
    await Browser.open({ url: startUrl(provider), presentationStyle: 'popover' })
  } catch (error) {
    await cleanup()
    throw error
  }

  return result
}
