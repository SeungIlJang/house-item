import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/index.ts'

function setup() {
  const states = new Map()
  const env = {
    CORS_ORIGINS: 'https://localhost', APP_REDIRECT_URI: 'com.homeitems.app://auth',
    JWT_SECRET_KEY: 'test-only-secret', GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret', KAKAO_REST_API_KEY: 'kakao-client',
    KAKAO_CLIENT_SECRET: 'kakao-secret',
    DB: { prepare(sql) {
      let args = []
      return {
        bind(...values) { args = values; return this },
        async run() {
          if (sql.startsWith('INSERT INTO oauth_states')) {
            states.set(args[0], { state: args[0], provider: args[1], code_verifier: args[2], expires_at: args[3] })
          }
          return { meta: { last_row_id: 7 } }
        },
        async first() {
          if (sql.startsWith('DELETE FROM oauth_states')) {
            const saved = states.get(args[0])
            if (saved?.provider !== args[1]) return null
            states.delete(args[0])
            return saved || null
          }
          if (sql.includes('FROM auth_identities')) return { user_id: 7 }
          if (sql.includes('FROM users')) return { id: 7, name: '테스트', email: null }
          return null
        },
      }
    } },
  }
  const request = (path, init) => app.request(`https://api.example${path}`, init, env)
  return { env, states, request }
}

test('missing provider credentials fail before redirecting', async () => {
  const { env, request } = setup()
  delete env.GOOGLE_CLIENT_SECRET
  const response = await request('/api/v1/auth/google/start')
  assert.equal(response.status, 503)
  assert.equal((await response.json()).errorCode, 'PROVIDER_NOT_CONFIGURED')
})

for (const provider of ['google', 'kakao']) {
  test(`${provider}: PKCE, token exchange, app return, authenticated user, and replay rejection`, async () => {
    const { request, states } = setup()
    const state = 'a'.repeat(64)
    const start = await request(`/api/v1/auth/${provider}/start?login_state=${state}`)
    assert.equal(start.status, 302)
    const authorize = new URL(start.headers.get('location'))
    assert.equal(authorize.searchParams.get('state'), state)
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(authorize.searchParams.get('redirect_uri'), `https://api.example/api/v1/auth/${provider}/callback`)
    assert.equal(authorize.searchParams.get('code_challenge').length, 43)
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith('/token')) {
        assert.equal(init.body.get('code_verifier'), states.get(state)?.code_verifier || verifier)
        assert.equal(init.body.get('client_secret'), `${provider}-secret`)
        return Response.json({ access_token: 'provider-access-token' })
      }
      return Response.json(provider === 'google'
        ? { sub: 'google-user', name: '테스트', email: 'unverified@example.com', email_verified: false }
        : { id: 123, kakao_account: { profile: { nickname: '테스트' } } })
    }
    const verifier = states.get(state).code_verifier
    try {
      const callback = await request(`/api/v1/auth/${provider}/callback?code=valid-code&state=${state}`)
      const redirect = new URL(callback.headers.get('location'))
      assert.equal(redirect.protocol, 'com.homeitems.app:')
      assert.equal(redirect.searchParams.get('state'), state)
      const token = redirect.searchParams.get('token')
      assert.ok(token)
      const me = await request('/api/v1/users/me', { headers: { Authorization: `Bearer ${token}` } })
      assert.equal(me.status, 200)
      assert.equal((await me.json()).data.id, 7)
      const replay = await request(`/api/v1/auth/${provider}/callback?code=valid-code&state=${state}`)
      assert.equal(new URL(replay.headers.get('location')).searchParams.get('error'), 'INVALID_STATE')
    } finally { globalThis.fetch = originalFetch }
  })
}

test('expired and wrong-provider states cannot be used', async () => {
  const { request, states } = setup()
  const start = await request('/api/v1/auth/google/start')
  const state = new URL(start.headers.get('location')).searchParams.get('state')
  const wrong = await request(`/api/v1/auth/kakao/callback?code=code&state=${state}`)
  assert.equal(new URL(wrong.headers.get('location')).searchParams.get('error'), 'INVALID_STATE')
  assert.ok(states.has(state))
  states.get(state).expires_at = 0
  const expired = await request(`/api/v1/auth/google/callback?code=code&state=${state}`)
  assert.equal(new URL(expired.headers.get('location')).searchParams.get('error'), 'INVALID_STATE')
})

test('cancellation consumes state and unauthenticated user access stays blocked', async () => {
  const { request, states } = setup()
  const start = await request('/api/v1/auth/kakao/start')
  const state = new URL(start.headers.get('location')).searchParams.get('state')
  const cancel = await request(`/api/v1/auth/kakao/callback?error=access_denied&state=${state}`)
  assert.equal(new URL(cancel.headers.get('location')).searchParams.get('error'), 'ACCESS_DENIED')
  assert.equal(states.size, 0)
  assert.equal((await request('/api/v1/users/me')).status, 401)
})
