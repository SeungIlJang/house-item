// 소셜 로그인(구글·카카오) 흐름.
//
// 구글은 임베디드 WebView 에서의 OAuth 를 차단한다(disallowed_useragent).
// 그래서 네이티브에서는 시스템 브라우저(Custom Tabs)로 열고,
// 서버가 발급한 토큰을 딥링크로 돌려받는다.
//
//   Browser.open(/auth/<provider>/start)
//     → 제공자 동의 → Worker 콜백 → com.homeitems.app://auth?token=...
//     → App 의 appUrlOpen 으로 수신
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { API_BASE_URL } from '@/api/client'

export type SocialProvider = 'google' | 'kakao'

export const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: 'Google',
  kakao: '카카오',
}

const ERROR_MESSAGE: Record<string, string> = {
  ACCESS_DENIED: '로그인이 취소되었습니다.',
  INVALID_STATE: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  TOKEN_EXCHANGE_FAILED: '로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  PROVIDER_NOT_CONFIGURED: '아직 준비되지 않은 로그인 방식입니다.',
  LOGIN_FAILED: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
}

export class SocialAuthError extends Error {
  readonly code: string
  constructor(code: string) {
    super(ERROR_MESSAGE[code] ?? '로그인에 실패했습니다.')
    this.code = code
  }
}

const startUrl = (provider: SocialProvider) => API_BASE_URL + '/auth/' + provider + '/start'

/** 딥링크/리다이렉트 URL 에서 토큰을 꺼낸다. 실패면 SocialAuthError 를 던진다. */
export function readCallbackUrl(url: string): string {
  const parsed = new URL(url)
  // 커스텀 스킴(com.homeitems.app://auth?token=)은 search 가 비어있을 수 있어 hash 도 본다.
  const params = parsed.searchParams.size > 0
    ? parsed.searchParams
    : new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const error = params.get('error')
  if (error) throw new SocialAuthError(error)
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

  const urlListener = await App.addListener('appUrlOpen', ({ url }) => handleUrl(url))
  const closeListener = await Browser.addListener('browserFinished', () => handleCancel())

  let settle: ((token: string) => void) | null = null
  let failWith: ((error: unknown) => void) | null = null

  const cleanup = async () => {
    settle = null
    failWith = null
    await urlListener.remove()
    await closeListener.remove()
  }

  function handleUrl(url: string) {
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

  try {
    await Browser.open({ url: startUrl(provider), presentationStyle: 'popover' })
  } catch (error) {
    await cleanup()
    throw error
  }

  return result
}
