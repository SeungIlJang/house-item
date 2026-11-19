import type { App, Row } from '../types.ts'
import { fail } from '../lib/http.ts'
import { b64url, makeToken } from '../lib/jwt.ts'
import { createDefaultHome } from '../lib/defaults.ts'

export function registerAuthRoutes(app: App) {
  // ──────────────────────────────────────────────────────────────
  // 소셜 로그인 (구글 · 카카오)
  //
  // 구글은 임베디드 WebView 에서의 OAuth 를 차단하므로(disallowed_useragent),
  // 앱은 시스템 브라우저(Custom Tabs)로 /start 를 열고, 교환은 서버에서 한다.
  // client_secret 은 Worker 에만 둔다.
  //
  //   앱 → GET /start → (브라우저) 제공자 동의 → GET /callback
  //     → 토큰 교환 → 사용자 조회·생성 → 자체 JWT → 딥링크로 앱 복귀
  // ──────────────────────────────────────────────────────────────

  type ProviderName = 'google' | 'kakao'
  type ProviderProfile = { providerUserId: string; name: string; email: string | null; avatarUrl: string | null }

  const STATE_TTL_SECONDS = 600

  const randomUrlSafe = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)))

  const pkceChallenge = async (verifier: string) =>
    b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))

  const callbackUrl = (c: any, provider: ProviderName) =>
    `${new URL(c.req.url).origin}/api/v1/auth/${provider}/callback`

  const providerConfig = (c: any, provider: ProviderName) => {
    if (provider === 'google') {
      return {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: c.env.GOOGLE_CLIENT_ID,
        clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        scope: 'openid profile email',
        extraAuthParams: { access_type: 'online', prompt: 'select_account' } as Record<string, string>,
      }
    }
    return {
      authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
      tokenUrl: 'https://kauth.kakao.com/oauth/token',
      clientId: c.env.KAKAO_REST_API_KEY,
      clientSecret: c.env.KAKAO_CLIENT_SECRET,
      scope: 'profile_nickname profile_image',
      extraAuthParams: {} as Record<string, string>,
    }
  }

  const fetchProfile = async (provider: ProviderName, accessToken: string): Promise<ProviderProfile> => {
    if (provider === 'google') {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('google userinfo ' + res.status)
      const p = await res.json<Row>()
      return {
        providerUserId: String(p.sub),
        name: p.name || p.given_name || '사용자',
        email: p.email_verified === true ? p.email ?? null : null,
        avatarUrl: p.picture ?? null,
      }
    }
    const res = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error('kakao user/me ' + res.status)
    const p = await res.json<Row>()
    const account = p.kakao_account ?? {}
    const profile = account.profile ?? {}
    return {
      providerUserId: String(p.id),
      name: profile.nickname || '사용자',
      // 이메일은 동의항목 심사를 통과하고 사용자가 동의했을 때만 내려온다.
      email: account.is_email_valid === true && account.is_email_verified === true ? account.email ?? null : null,
      avatarUrl: profile.profile_image_url ?? null,
    }
  }

  // 기존 식별자가 있으면 그 계정, 없으면 같은 이메일 계정에 연결, 그것도 없으면 신규 생성.
  const resolveUser = async (c: any, provider: ProviderName, profile: ProviderProfile) => {
    const identity = await c.env.DB
      .prepare('SELECT user_id FROM auth_identities WHERE provider=? AND provider_user_id=?')
      .bind(provider, profile.providerUserId).first() as Row | null
    if (identity) return Number(identity.user_id)

    let userId: number | null = null
    if (profile.email) {
      const existing = await c.env.DB
        .prepare('SELECT id FROM users WHERE email IS NOT NULL AND lower(email)=lower(?)')
        .bind(profile.email).first() as Row | null
      if (existing) userId = Number(existing.id)
    }

    if (userId === null) {
      const created = await c.env.DB
        .prepare('INSERT INTO users(email,name,avatar_url) VALUES(?,?,?)')
        .bind(profile.email, profile.name, profile.avatarUrl).run()
      userId = Number(created.meta.last_row_id)
      // 가입 직후 바로 물건을 등록할 수 있도록 기본 집과 보관장소를 만든다. 실패해도 로그인은 계속한다.
      await createDefaultHome(c.env.DB, userId).catch((error) => console.error('default home failed', (error as Error)?.message))
    }

    await c.env.DB
      .prepare('INSERT INTO auth_identities(user_id,provider,provider_user_id) VALUES(?,?,?)')
      .bind(userId, provider, profile.providerUserId).run()
    return userId
  }

  /**
   * 로그인 결과를 돌려보낸다.
   * - 앱: APP_REDIRECT_URI(커스텀 스킴) 의 쿼리로 전달한다.
   * - 웹: /start 에서 허용 목록으로 검증해 저장해 둔 return_to 로 보낸다.
   *   토큰은 # 뒤(fragment)에 넣어 서버 로그·Referer 에 남지 않게 한다.
   */
  const appRedirect = (c: any, params: Record<string, string>, returnTo?: string | null) => {
    const target = new URL(returnTo || c.env.APP_REDIRECT_URI)
    const values = new URLSearchParams()
    const state = c.req.query('state')
    if (state) values.set('state', state)
    for (const [k, val] of Object.entries(params)) values.set(k, val)
    if (returnTo) target.hash = values.toString()
    else values.forEach((val, k) => target.searchParams.set(k, val))
    return c.redirect(target.toString(), 302)
  }

  /** 웹 복귀 주소는 WEB_REDIRECT_URIS(쉼표 구분) 에 정확히 같은 값이 있을 때만 허용한다. */
  const allowedReturnTo = (c: any, value: string | undefined) => {
    if (!value) return null
    const allowed = String(c.env.WEB_REDIRECT_URIS ?? '').split(',').map((v) => v.trim()).filter(Boolean)
    return allowed.includes(value) ? value : undefined
  }

  app.get('/api/v1/auth/:provider/start', async (c) => {
    const provider = c.req.param('provider') as ProviderName
    if (provider !== 'google' && provider !== 'kakao') return c.json(fail('지원하지 않는 로그인입니다.', 'UNSUPPORTED_PROVIDER'), 404)

    const cfg = providerConfig(c, provider)
    if (!cfg.clientId || (provider === 'google' && !cfg.clientSecret)) return c.json(fail('로그인 설정이 준비되지 않았습니다.', 'PROVIDER_NOT_CONFIGURED'), 503)

    const requestedState = c.req.query('login_state')
    if (requestedState && !/^[a-f0-9]{64}$/.test(requestedState)) {
      return c.json(fail('잘못된 로그인 요청입니다.', 'INVALID_STATE'), 400)
    }
    const returnTo = allowedReturnTo(c, c.req.query('return_to'))
    if (returnTo === undefined) return c.json(fail('허용되지 않은 복귀 주소입니다.', 'INVALID_RETURN_TO'), 400)
    const state = requestedState || randomUrlSafe(32)
    const verifier = randomUrlSafe(32)
    await c.env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(Math.floor(Date.now() / 1000)).run()
    await c.env.DB
      .prepare('INSERT INTO oauth_states(state,provider,code_verifier,expires_at,return_to) VALUES(?,?,?,?,?)')
      .bind(state, provider, verifier, Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS, returnTo).run()

    const url = new URL(cfg.authorizeUrl)
    url.searchParams.set('client_id', cfg.clientId)
    url.searchParams.set('redirect_uri', callbackUrl(c, provider))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', cfg.scope)
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', await pkceChallenge(verifier))
    url.searchParams.set('code_challenge_method', 'S256')
    for (const [k, val] of Object.entries(cfg.extraAuthParams)) url.searchParams.set(k, val)
    return c.redirect(url.toString(), 302)
  })

  app.get('/api/v1/auth/:provider/callback', async (c) => {
    const provider = c.req.param('provider') as ProviderName
    if (provider !== 'google' && provider !== 'kakao') return c.json(fail('지원하지 않는 로그인입니다.', 'UNSUPPORTED_PROVIDER'), 404)

    const code = c.req.query('code')
    const state = c.req.query('state')
    if (!state) return appRedirect(c, { error: 'INVALID_STATE' })

    // state 는 1회용. 조회 즉시 삭제해 재사용을 막는다.
    const saved = await c.env.DB.prepare('DELETE FROM oauth_states WHERE state=? AND provider=? RETURNING *').bind(state, provider).first<Row>()
    if (!saved || saved.provider !== provider || Number(saved.expires_at) < Math.floor(Date.now() / 1000)) {
      return appRedirect(c, { error: 'INVALID_STATE' })
    }
    // 웹에서 시작한 로그인이면 결과를 그 웹 주소로 돌려보낸다(시작 때 허용 목록으로 검증됨).
    const back = saved.return_to ? String(saved.return_to) : null
    if (c.req.query('error') || !code) return appRedirect(c, { error: 'ACCESS_DENIED' }, back)

    try {
      const cfg = providerConfig(c, provider)
      const form = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: cfg.clientId,
        redirect_uri: callbackUrl(c, provider),
        code,
        code_verifier: String(saved.code_verifier),
      })
      if (cfg.clientSecret) form.set('client_secret', cfg.clientSecret)

      const tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      })
      if (!tokenRes.ok) {
        // 원인 파악용으로 제공자의 오류 코드만 남긴다(토큰·키는 응답에 없고, 남기지도 않는다).
        const body = await tokenRes.json<Row>().catch(() => ({} as Row))
        console.warn('oauth token exchange failed', { provider, status: tokenRes.status, error: body.error, errorCode: body.error_code, description: body.error_description })
        // 제공자 오류 코드(예: KOE010)를 함께 넘겨 화면에서 원인을 바로 알 수 있게 한다. 비밀 정보는 들어 있지 않다.
        const detail = String(body.error_code || body.error || `HTTP ${tokenRes.status}`).replace(/[^\w .-]/g, '').slice(0, 40)
        return appRedirect(c, { error: 'TOKEN_EXCHANGE_FAILED', detail }, back)
      }
      const token = await tokenRes.json<Row>()
      if (!token.access_token) return appRedirect(c, { error: 'TOKEN_EXCHANGE_FAILED' }, back)

      const profile = await fetchProfile(provider, token.access_token)
      const userId = await resolveUser(c, provider, profile)
      const accessToken = await makeToken(userId, c.env.JWT_SECRET_KEY, true)
      return appRedirect(c, { token: accessToken }, back)
    } catch (error) {
      console.error('oauth login failed', { provider, message: (error as Error)?.message })
      return appRedirect(c, { error: 'LOGIN_FAILED' }, back)
    }
  })
}
