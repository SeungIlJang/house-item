// 영어 화면용 서버 문구 검증.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { setup } from './helpers/env.mjs'
import { LABELS, requestLang, toEnglish } from '../src/lib/i18n.ts'

const HANGUL = /[가-힣]/

test('요청 언어: 한국어가 아니면 영어, 헤더가 없으면 한국어', () => {
  assert.equal(requestLang(undefined), 'ko')
  assert.equal(requestLang(''), 'ko')
  assert.equal(requestLang('ko'), 'ko')
  assert.equal(requestLang('ko-KR,ko;q=0.9,en;q=0.8'), 'ko')
  assert.equal(requestLang('en'), 'en')
  assert.equal(requestLang('en-US,en;q=0.9,ko;q=0.8'), 'en')
  assert.equal(requestLang('ja-JP'), 'en')
})

test('서버 코드의 모든 한국어 문구에 영어 번역이 있다', async () => {
  const root = new URL('../src/', import.meta.url)
  const files = ['index.ts']
  for (const dir of ['lib', 'routes']) for (const name of await readdir(new URL(dir, root))) files.push(`${dir}/${name}`)
  // 사용자에게 가지 않는 것: 번역 표 자신, 기본 이름(따로 영어판이 있다), 날짜 읽기용 정규식.
  const skip = new Set(['lib/i18n.ts', 'lib/defaults.ts', 'lib/labelDate.ts'])
  const missing = []
  let checked = 0
  for (const file of files.filter((f) => !skip.has(f))) {
    const lines = (await readFile(new URL(file, root), 'utf8')).split(/\r?\n/)
    for (const line of lines) {
      const code = line.replace(/\/\/.*$/, '') // 주석 제외
      if (/^\s*(\*|\/\*)/.test(line) || /console\.(log|warn|error)/.test(code)) continue
      for (const [literal] of code.matchAll(/'[^']*'|`[^`]*`/g)) {
        const text = literal.slice(1, -1)
        if (!HANGUL.test(text)) continue
        if (text === '사용자') continue // 이름이 없는 가입자의 기본 이름. auth.ts 가 언어에 맞춰 고른다.
        checked += 1
        // 항목 이름만 있는 문자열(검증 함수에 넘기는 label)
        if (!/[.]$/.test(text)) {
          const name = text.replace('${label}', '카테고리')
          if (!LABELS[name]) missing.push(`${file}: 항목 이름 '${text}'`)
          continue
        }
        // 값이 들어가는 문구는 실제 값으로 채워 본다.
        const samples = text.includes('${label}')
          ? Object.keys(LABELS).map((label) => text.replace('${label}', label))
          : [text]
        for (const sample of samples) {
          const filled = sample.replace(/\$\{[^}]+\}/g, '3')
          if (HANGUL.test(toEnglish(filled))) missing.push(`${file}: '${filled}'`)
        }
      }
    }
  }
  assert.ok(checked > 50, `문구를 충분히 찾지 못했다(${checked}개)`)
  assert.deepEqual(missing, [])
})

test('영어 요청에는 오류 문구가 영어로, 그 밖에는 한국어로 나간다', async () => {
  const { user, env } = setup()
  const { call, token } = await user()

  const english = await call('POST', '/homes', {}, { lang: 'en-US,en;q=0.9' })
  assert.equal(english.status, 422)
  assert.equal(english.code, 'VALIDATION_ERROR')
  assert.equal(english.json.message, 'Home name is required.')
  assert.equal(english.json.success, false)

  const korean = await call('POST', '/homes', {}, { lang: 'ko-KR' })
  assert.equal(korean.json.message, '집 이름을(를) 입력해주세요.')
  assert.equal((await call('POST', '/homes', {})).json.message, '집 이름을(를) 입력해주세요.')

  const tooLong = await call('POST', '/homes', { name: 'x'.repeat(500) }, { lang: 'en' })
  assert.match(tooLong.json.message, /^Home name must be \d+ characters or fewer\.$/)
  assert.equal((await call('GET', '/items/999999', undefined, { lang: 'en' })).json.message, 'Not found.')

  // 정상 응답은 그대로다.
  const created = await call('POST', '/homes', { name: '우리집' }, { lang: 'en' })
  assert.equal(created.status, 201)
  assert.equal(created.data.name, '우리집')

  // 인증 오류와 CORS 헤더
  const app = (await import('../src/index.ts')).default
  const denied = await app.request('https://api.example/api/v1/items', { headers: { 'Accept-Language': 'en', Origin: 'https://localhost' } }, env)
  assert.equal(denied.status, 401)
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), 'https://localhost')
  assert.deepEqual(await denied.json(), { success: false, data: null, message: 'Please sign in.', errorCode: 'NOT_AUTHENTICATED' })

  // 탈퇴 완료 문구
  const deleted = await app.request('https://api.example/api/v1/users/me', {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'en' },
  }, env, { waitUntil() {}, passThroughOnException() {} })
  assert.equal(deleted.status, 200)
  assert.equal((await deleted.json()).message, 'Your account has been deleted.')
})

test('가입: 영어 기기에서 가입하면 기본 집과 보관장소가 영어 이름이다', async () => {
  const { env } = setup({ GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret' })
  const app = (await import('../src/index.ts')).default
  const en = { 'Accept-Language': 'en-GB,en;q=0.9' }
  const request = (path, headers = {}) => app.request(`https://api.example${path}`, { headers: { ...en, ...headers } }, env)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => String(url).endsWith('/token')
    ? Response.json({ access_token: 't' })
    : Response.json({ sub: 'english-user', email_verified: false })
  try {
    const state = 'a'.repeat(64)
    await request(`/api/v1/auth/google/start?login_state=${state}`)
    const back = new URL((await request(`/api/v1/auth/google/callback?code=c&state=${state}`)).headers.get('location'))
    const auth = { Authorization: `Bearer ${back.searchParams.get('token')}` }
    assert.equal((await (await request('/api/v1/users/me', auth)).json()).data.name, 'User')
    const homes = (await (await request('/api/v1/homes', auth)).json()).data
    assert.deepEqual(homes.map((h) => h.name), ['My home'])
    const rooms = (await (await request(`/api/v1/homes/${homes[0].id}/rooms`, auth)).json()).data
    assert.deepEqual(rooms.map((r) => r.name), ['Living room', 'Kitchen', 'Bedroom', 'Small room', 'Bathroom', 'Balcony', 'Entrance'])
  } finally { globalThis.fetch = originalFetch }
})
