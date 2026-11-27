// API 동작 검증. 실제 마이그레이션을 적용한 SQLite 위에서 Worker 를 그대로 실행한다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { setup, imageForm } from './helpers/env.mjs'
import { LIMITS } from '../src/lib/limits.ts'

/** 집 → 방 → 수납공간(3단계) → 카테고리 → 태그 2개를 만든다. */
async function seed(call, prefix = '') {
  const home = (await call('POST', '/homes', { name: `${prefix}우리집` })).data
  const room = (await call('POST', `/homes/${home.id}/rooms`, { name: '안방' })).data
  const s1 = (await call('POST', `/rooms/${room.id}/storage-locations`, { name: '붙박이장' })).data
  const s2 = (await call('POST', `/rooms/${room.id}/storage-locations`, { name: '서랍', parentId: s1.id })).data
  const s3 = (await call('POST', `/rooms/${room.id}/storage-locations`, { name: '두 번째 칸', parentId: s2.id })).data
  const category = (await call('POST', '/categories', { name: `${prefix}서류` })).data
  const tag1 = (await call('POST', '/tags', { name: `${prefix}중요` })).data
  const tag2 = (await call('POST', '/tags', { name: `${prefix}여행` })).data
  return { home, room, s1, s2, s3, category, tag1, tag2 }
}

test('입력 검증: 잘못된 입력은 500 이 아니라 400/404/422', async () => {
  const { user } = setup()
  const { call } = await user()
  assert.equal((await call('POST', '/homes', {})).code, 'VALIDATION_ERROR')
  assert.equal((await call('POST', '/homes', { name: '   ' })).status, 422)
  assert.equal((await call('POST', '/homes', { name: 'x'.repeat(101) })).status, 422)
  assert.equal((await call('POST', '/homes', { name: 123 })).status, 422)
  assert.equal((await call('POST', '/homes', undefined, { raw: '{oops' })).code, 'INVALID_JSON')
  assert.equal((await call('POST', '/homes', [1, 2])).status, 400)
  assert.equal((await call('GET', '/homes/abc')).status, 404)
  assert.equal((await call('GET', '/homes/99999')).status, 404)

  const { home, room } = await seed(call)
  const base = { homeId: home.id, roomId: room.id, name: '여권' }
  assert.equal((await call('POST', '/items', { ...base, purchaseDate: '2026-02-30' })).status, 422)
  assert.equal((await call('POST', '/items', { ...base, purchaseDate: '2026-05-01', expirationDate: '2026-04-01' })).status, 422)
  assert.equal((await call('POST', '/items', { ...base, quantity: -1 })).status, 422)
  assert.equal((await call('POST', '/items', { ...base, quantity: 1.5 })).status, 422)
  assert.equal((await call('POST', '/items', { ...base, tagIds: 'x' })).status, 422)
  assert.equal((await call('GET', '/items/search?room_id=abc')).status, 422)
  assert.equal((await call('GET', '/items?page=abc')).status, 200)

  // 이름은 선택 (앱에서 사진만 찍고 저장하는 경우)
  const noName = await call('POST', '/items', { homeId: home.id, roomId: room.id })
  assert.equal(noName.status, 201)
  assert.equal(noName.data.name, '')
})

test('소유권: 남의 집·방·수납공간·카테고리·태그를 연결할 수 없다', async () => {
  const { user } = setup()
  const a = await user('A')
  const b = await user('B')
  const mine = await seed(a.call)
  const theirs = await seed(b.call, 'B')
  const base = { homeId: mine.home.id, roomId: mine.room.id, name: '여권' }

  const cases = [
    [{ ...base, homeId: theirs.home.id }, 'INVALID_HOME'],
    [{ ...base, roomId: theirs.room.id }, 'ROOM_HOME_MISMATCH'],
    [{ ...base, storageLocationId: theirs.s1.id }, 'STORAGE_ROOM_MISMATCH'],
    [{ ...base, categoryId: theirs.category.id }, 'CATEGORY_NOT_FOUND'],
    [{ ...base, tagIds: [mine.tag1.id, theirs.tag1.id] }, 'TAG_NOT_FOUND'],
    [{ homeId: mine.home.id, storageLocationId: mine.s1.id }, 'STORAGE_WITHOUT_ROOM'],
  ]
  for (const [body, code] of cases) {
    const res = await a.call('POST', '/items', body)
    assert.equal(res.code, code, JSON.stringify(body))
  }

  const item = (await a.call('POST', '/items', base)).data
  assert.equal((await a.call('PUT', `/items/${item.id}`, { ...base, homeId: theirs.home.id })).code, 'INVALID_HOME')
  assert.equal((await a.call('PUT', `/items/${item.id}`, { ...base, tagIds: [theirs.tag2.id] })).code, 'TAG_NOT_FOUND')

  // 남의 수납공간을 상위로 지정할 수 없다
  const parent = await a.call('POST', `/rooms/${mine.room.id}/storage-locations`, { name: 'x', parentId: theirs.s1.id })
  assert.equal(parent.code, 'STORAGE_PARENT_INVALID')

  // 남의 데이터는 조회·수정·삭제 모두 404
  assert.equal((await b.call('GET', `/items/${item.id}`)).status, 404)
  assert.equal((await b.call('PUT', `/homes/${mine.home.id}`, { name: 'hack' })).status, 404)
  assert.equal((await b.call('DELETE', `/rooms/${mine.room.id}`)).status, 404)
  assert.equal((await b.call('DELETE', `/tags/${mine.tag1.id}`)).status, 404)
  assert.equal((await b.call('GET', '/items')).data.totalElements, 0 + 0)
})

test('수납공간: 경로 계산과 순환 지정 차단', async () => {
  const { user } = setup()
  const { call } = await user()
  const { s1, s2, s3 } = await seed(call)
  assert.equal(s3.fullPath, '붙박이장 > 서랍 > 두 번째 칸')

  assert.equal((await call('PUT', `/storage-locations/${s1.id}`, { name: '붙박이장', parentId: s1.id })).code, 'STORAGE_CYCLE')
  assert.equal((await call('PUT', `/storage-locations/${s1.id}`, { name: '붙박이장', parentId: s3.id })).code, 'STORAGE_CYCLE')
  assert.equal((await call('PUT', `/storage-locations/${s1.id}`, { name: '붙박이장', parentId: s2.id })).code, 'STORAGE_CYCLE')

  const moved = await call('PUT', `/storage-locations/${s3.id}`, { name: '두 번째 칸', parentId: s1.id })
  assert.equal(moved.data.fullPath, '붙박이장 > 두 번째 칸')
  const renamed = await call('PUT', `/storage-locations/${s2.id}`, { name: '서랍장', parentId: s1.id })
  assert.equal(renamed.data.fullPath, '붙박이장 > 서랍장')
})

test('물건 목록: 20개를 불러와도 쿼리 수가 D1 무료 한도(50) 보다 훨씬 적다', async () => {
  const { user } = setup()
  const { call } = await user()
  const { home, room, s2, s3, category, tag1, tag2 } = await seed(call)
  for (let i = 0; i < 25; i++) {
    const item = (await call('POST', '/items', {
      homeId: home.id, roomId: room.id, name: `물건${String(i).padStart(2, '0')}`,
      storageLocationId: i % 2 ? s2.id : s3.id, categoryId: category.id, tagIds: [tag1.id, tag2.id],
    })).data
    if (i < 3) await call('POST', `/items/${item.id}/images`, undefined, { form: imageForm() })
  }

  const list = await call('GET', '/items?page=1&size=20')
  assert.equal(list.status, 200)
  assert.equal(list.data.totalElements, 25)
  assert.equal(list.data.totalPages, 2)
  assert.equal(list.data.content.length, 20)
  assert.ok(list.queries <= 8, `쿼리 ${list.queries}회`)
  // DB 왕복은 사용자 확인 1회 + 목록 batch 1회뿐이고, 둘은 동시에 나간다.
  assert.equal(list.trips, 2, `DB 왕복 ${list.trips}회`)
  for (const item of list.data.content) {
    assert.ok(item.storageFullPath.startsWith('붙박이장 > '))
    assert.deepEqual(item.tags.map((t) => t.name), ['여행', '중요'])
    assert.equal(item.categoryName, '서류')
    assert.equal(item.roomName, '안방')
  }

  // 페이지 크기를 최대(100)로 키워도 쿼리 수는 그대로
  const big = await call('GET', '/items?size=100')
  assert.equal(big.data.content.length, 25)
  assert.ok(big.queries <= 8, `쿼리 ${big.queries}회`)
  assert.equal(big.data.content.filter((i) => i.thumbnailUrl).length, 3)

  const search = await call('GET', `/items/search?keyword=물건0&tag_id=${tag1.id}&sort=name`)
  assert.deepEqual(search.data.content.map((i) => i.name), Array.from({ length: 10 }, (_, i) => `물건0${i}`))
})

test('유통기한 임박: 기준일 이전 만료 물건만, 만료일 순으로', async () => {
  const { user } = setup()
  const { call } = await user()
  const { home, room } = await seed(call)
  const add = (name, expirationDate) => call('POST', '/items', { homeId: home.id, roomId: room.id, name, expirationDate })
  await add('우유', '2026-11-21')
  await add('지난 약', '2026-11-01')
  await add('통조림', '2027-06-01')
  await add('기한 없음', null)
  await add('오늘까지', '2026-11-19')

  const soon = await call('GET', '/items/search?expires_before=2026-11-26&sort=expiration')
  assert.deepEqual(soon.data.content.map((i) => i.name), ['지난 약', '오늘까지', '우유'])

  const all = await call('GET', '/items/search?sort=expiration')
  assert.deepEqual(all.data.content.map((i) => i.name), ['지난 약', '오늘까지', '우유', '통조림', '기한 없음'])

  assert.equal((await call('GET', '/items/search?expires_before=2026-13-01')).status, 422)
})

test('물건 수정: 태그 교체와 이름 변경', async () => {
  const { user } = setup()
  const { call } = await user()
  const { home, room, s3, tag1, tag2 } = await seed(call)
  const base = { homeId: home.id, roomId: room.id, name: '여권' }
  const created = await call('POST', '/items', { ...base, storageLocationId: s3.id, tagIds: [tag1.id, tag2.id, tag1.id] })
  assert.equal(created.status, 201)
  assert.equal(created.data.tags.length, 2)
  assert.equal(created.data.storageFullPath, '붙박이장 > 서랍 > 두 번째 칸')

  const updated = await call('PUT', `/items/${created.data.id}`, { ...base, name: '여권(갱신)', tagIds: [tag2.id] })
  assert.equal(updated.data.name, '여권(갱신)')
  assert.deepEqual(updated.data.tags.map((t) => t.name), ['여행'])
  assert.equal(updated.data.storageLocationId, null)
})

test('카테고리·태그: 같은 이름은 409', async () => {
  const { user } = setup()
  const { call } = await user()
  const first = await call('POST', '/categories', { name: '서류' })
  assert.equal(first.status, 201)
  assert.equal((await call('POST', '/categories', { name: '서류' })).code, 'DUPLICATE_NAME')
  const other = (await call('POST', '/categories', { name: '공구' })).data
  assert.equal((await call('PUT', `/categories/${other.id}`, { name: '서류' })).code, 'DUPLICATE_NAME')
})

test('사진: 이미지 형식만 받고, 삭제하면 R2 에서도 지운다', async () => {
  const { user, IMAGES } = setup()
  const { call } = await user()
  const { home, room } = await seed(call)
  const item = (await call('POST', '/items', { homeId: home.id, roomId: room.id, name: '여권' })).data
  const upload = (form) => call('POST', `/items/${item.id}/images`, undefined, { form })

  assert.equal((await upload(imageForm('a.txt', 'text/plain'))).code, 'INVALID_FILE')
  assert.equal((await upload(imageForm('a.png', 'text/html'))).code, 'INVALID_FILE')
  assert.equal((await upload(imageForm('noext', 'image/png'))).code, 'INVALID_FILE')

  // MIME 없이 온 파일(multipart 에서 application/octet-stream)은 확장자로 판단한다
  const ok = await upload(imageForm('photo.png', ''))
  assert.equal(ok.status, 201)
  const key = new URL(ok.data.imageUrl).pathname.slice(1)
  assert.equal(IMAGES.objects.get(key).httpMetadata.contentType, 'image/png')

  assert.equal((await call('DELETE', `/items/${item.id}/images/${ok.data.id}`)).status, 200)
  assert.equal(IMAGES.objects.has(key), false)
})

test('삭제: 집을 지우면 그 집 사진만 R2 에서 지우고, 방 삭제는 사진을 남긴다', async () => {
  const { user, IMAGES } = setup()
  const { call } = await user()
  const keyOf = (res) => new URL(res.data.imageUrl).pathname.slice(1)

  const h1 = (await call('POST', '/homes', { name: '집1' })).data
  const r1 = (await call('POST', `/homes/${h1.id}/rooms`, { name: '방' })).data
  const i1 = (await call('POST', '/items', { homeId: h1.id, roomId: r1.id, name: 'a' })).data
  const h2 = (await call('POST', '/homes', { name: '집2' })).data
  const r2 = (await call('POST', `/homes/${h2.id}/rooms`, { name: '방' })).data
  const i2 = (await call('POST', '/items', { homeId: h2.id, roomId: r2.id, name: 'b' })).data
  const k1 = keyOf(await call('POST', `/items/${i1.id}/images`, undefined, { form: imageForm() }))
  const k2 = keyOf(await call('POST', `/items/${i1.id}/images`, undefined, { form: imageForm() }))
  const k3 = keyOf(await call('POST', `/items/${i2.id}/images`, undefined, { form: imageForm() }))

  await call('DELETE', `/rooms/${r2.id}`)
  const kept = await call('GET', `/items/${i2.id}`)
  assert.equal(kept.data.roomId, null)
  assert.equal(kept.data.images.length, 1)
  assert.ok(IMAGES.objects.has(k3))

  await call('DELETE', `/homes/${h1.id}`)
  assert.equal(IMAGES.objects.has(k1), false)
  assert.equal(IMAGES.objects.has(k2), false)
  assert.ok(IMAGES.objects.has(k3))
  assert.equal((await call('GET', `/items/${i1.id}`)).status, 404)
})

test('회원 탈퇴: 내 데이터와 사진만 모두 지우고 카카오 연결을 끊는다', async () => {
  const { user, DB, IMAGES } = setup({ KAKAO_ADMIN_KEY: 'admin-key' })
  const a = await user('A')
  const b = await user('B')
  DB.raw.prepare("INSERT INTO auth_identities(user_id,provider,provider_user_id) VALUES(?,'kakao','555')").run(a.id)
  const mine = await seed(a.call)
  const theirs = await seed(b.call, 'B')
  const myItem = (await a.call('POST', '/items', { homeId: mine.home.id, roomId: mine.room.id, tagIds: [mine.tag1.id] })).data
  const theirItem = (await b.call('POST', '/items', { homeId: theirs.home.id, roomId: theirs.room.id })).data
  await a.call('POST', `/items/${myItem.id}/images`, undefined, { form: imageForm() })
  await b.call('POST', `/items/${theirItem.id}/images`, undefined, { form: imageForm() })
  IMAGES.objects.set(`items/${a.id}/999/orphan.png`, { bytes: new Uint8Array(), httpMetadata: {} }) // DB 에 없는 고아 파일

  const unlinked = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    unlinked.push({ url: String(url), auth: init.headers.Authorization, body: String(init.body) })
    return new Response('{}')
  }
  try {
    const res = await a.call('DELETE', '/users/me')
    assert.equal(res.status, 200)
  } finally { globalThis.fetch = originalFetch }

  // 탈퇴한 사용자의 토큰은 조회(사용자 확인과 동시에 실행된다)도 변경도 모두 401 로 막힌다.
  assert.equal((await a.call('GET', '/users/me')).status, 401)
  const afterList = await a.call('GET', '/items')
  assert.equal(afterList.status, 401)
  assert.equal(afterList.code, 'USER_NOT_FOUND')
  assert.equal(afterList.data, null) // 조회 결과는 버려진다
  assert.equal((await a.call('POST', '/homes', { name: '다시' })).code, 'USER_NOT_FOUND')
  const count = (sql) => DB.raw.prepare(sql).get(a.id).n
  for (const table of ['homes', 'items', 'categories', 'tags', 'auth_identities']) {
    assert.equal(count(`SELECT count(*) n FROM ${table} WHERE user_id=?`), 0, table)
  }
  assert.equal(DB.raw.prepare('SELECT count(*) n FROM rooms r LEFT JOIN homes h ON h.id=r.home_id WHERE h.id IS NULL').get().n, 0)
  assert.equal(DB.raw.prepare('SELECT count(*) n FROM item_images ii LEFT JOIN items i ON i.id=ii.item_id WHERE i.id IS NULL').get().n, 0)
  assert.equal([...IMAGES.objects.keys()].filter((k) => k.startsWith(`items/${a.id}/`)).length, 0)
  assert.equal([...IMAGES.objects.keys()].filter((k) => k.startsWith(`items/${b.id}/`)).length, 1)
  assert.equal((await b.call('GET', `/items/${theirItem.id}`)).status, 200)

  assert.equal(unlinked.length, 1)
  assert.equal(unlinked[0].url, 'https://kapi.kakao.com/v1/user/unlink')
  assert.equal(unlinked[0].auth, 'KakaoAK admin-key')
  assert.match(unlinked[0].body, /target_id=555/)
})

test('웹 로그인: 허용된 복귀 주소로만, 토큰은 # 뒤에 담아 돌려보낸다', async () => {
  const WEB = 'https://web.example/auth/callback'
  const { env } = setup({
    WEB_REDIRECT_URIS: `${WEB}, http://localhost:5173/auth/callback`,
    GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret', KAKAO_REST_API_KEY: 'kakao-client',
  })
  const app = (await import('../src/index.ts')).default
  const request = (path) => app.request(`https://api.example${path}`, {}, env)

  // 허용 목록에 없는 주소는 거부 (토큰을 외부 사이트로 보내지 않는다)
  for (const bad of ['https://evil.example/auth/callback', 'https://web.example/auth/callback?x=1', 'https://web.example']) {
    const res = await request(`/api/v1/auth/google/start?return_to=${encodeURIComponent(bad)}`)
    assert.equal(res.status, 400, bad)
    assert.equal((await res.json()).errorCode, 'INVALID_RETURN_TO')
  }

  const state = 'b'.repeat(64)
  const start = await request(`/api/v1/auth/google/start?login_state=${state}&return_to=${encodeURIComponent(WEB)}`)
  assert.equal(start.status, 302)

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => String(url).endsWith('/token')
    ? Response.json({ access_token: 'provider-token' })
    : Response.json({ sub: 'g-web', name: '웹사용자', email: 'web@example.com', email_verified: true })
  try {
    const callback = await request(`/api/v1/auth/google/callback?code=c&state=${state}`)
    const location = new URL(callback.headers.get('location'))
    assert.equal(`${location.origin}${location.pathname}`, WEB)
    assert.equal(location.search, '') // 쿼리가 아니라 fragment 로만
    const params = new URLSearchParams(location.hash.slice(1))
    assert.equal(params.get('state'), state)
    assert.ok(params.get('token'))

    const me = await app.request('https://api.example/api/v1/users/me', { headers: { Authorization: `Bearer ${params.get('token')}` } }, env)
    assert.equal((await me.json()).data.name, '웹사용자')

    // 취소하면 웹 주소로 오류를 돌려보낸다
    const state2 = 'c'.repeat(64)
    await request(`/api/v1/auth/google/start?login_state=${state2}&return_to=${encodeURIComponent(WEB)}`)
    const cancel = new URL((await request(`/api/v1/auth/google/callback?error=access_denied&state=${state2}`)).headers.get('location'))
    assert.equal(new URLSearchParams(cancel.hash.slice(1)).get('error'), 'ACCESS_DENIED')
  } finally { globalThis.fetch = originalFetch }

  // return_to 없이 시작하면 기존처럼 앱 딥링크로
  const state3 = 'd'.repeat(64)
  await request(`/api/v1/auth/kakao/start?login_state=${state3}`)
  const appBack = new URL((await request(`/api/v1/auth/kakao/callback?error=access_denied&state=${state3}`)).headers.get('location'))
  assert.equal(appBack.protocol, 'com.homeitems.app:')
  assert.equal(appBack.searchParams.get('error'), 'ACCESS_DENIED')
})

test('가입: 새 사용자에게 기본 집과 보관장소를 만들어 준다 (다시 로그인해도 중복 생성 없음)', async () => {
  const { env, DB } = setup({ GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret' })
  const app = (await import('../src/index.ts')).default
  const request = (path, init) => app.request(`https://api.example${path}`, init ?? {}, env)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => String(url).endsWith('/token')
    ? Response.json({ access_token: 't' })
    : Response.json({ sub: 'new-user', name: '새사용자', email_verified: false })
  const login = async (state) => {
    await request(`/api/v1/auth/google/start?login_state=${state}`)
    const back = new URL((await request(`/api/v1/auth/google/callback?code=c&state=${state}`)).headers.get('location'))
    return back.searchParams.get('token')
  }
  try {
    const token = await login('e'.repeat(64))
    const auth = { headers: { Authorization: `Bearer ${token}` } }
    const homes = (await (await request('/api/v1/homes', auth)).json()).data
    assert.deepEqual(homes.map((h) => h.name), ['우리집'])
    const rooms = (await (await request(`/api/v1/homes/${homes[0].id}/rooms`, auth)).json()).data
    assert.deepEqual(rooms.map((r) => r.name), ['거실', '주방', '안방', '작은방', '화장실', '베란다', '현관'])

    // 가입 직후 바로 물건을 등록할 수 있다
    const item = await request('/api/v1/items', { method: 'POST', headers: { ...auth.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ homeId: homes[0].id, roomId: rooms[0].id, name: '리모컨' }) })
    assert.equal(item.status, 201)

    await login('f'.repeat(64))
    assert.equal(DB.raw.prepare('SELECT count(*) n FROM homes').get().n, 1)
    assert.equal(DB.raw.prepare('SELECT count(*) n FROM users').get().n, 1)
  } finally { globalThis.fetch = originalFetch }
})

test('사진: 물건당 3장까지만 올릴 수 있다', async () => {
  assert.equal(LIMITS.imagesPerItem, 3)
  const { user } = setup()
  const { call } = await user()
  const { home, room } = await seed(call)
  const item = (await call('POST', '/items', { homeId: home.id, roomId: room.id, name: '앨범' })).data
  for (let i = 0; i < LIMITS.imagesPerItem; i++) {
    assert.equal((await call('POST', `/items/${item.id}/images`, undefined, { form: imageForm() })).status, 201)
  }
  const over = await call('POST', `/items/${item.id}/images`, undefined, { form: imageForm() })
  assert.equal(over.status, 422)
  assert.equal(over.code, 'IMAGE_LIMIT')
})

test('사용량 제한: 사용자별 사진 총량, 하루 업로드 수, 물건 수', async () => {
  const { user, DB } = setup()
  const a = await user('A')
  const b = await user('B')
  const mine = await seed(a.call)
  const theirs = await seed(b.call, 'B')
  const newItem = async (who, place, name) => (await who.call('POST', '/items', { homeId: place.home.id, roomId: place.room.id, name })).data
  const upload = (who, itemId) => who.call('POST', `/items/${itemId}/images`, undefined, { form: imageForm() })
  // 사진 기록을 DB 에 직접 넣어 많은 사진이 있는 상태를 만든다 (when: SQLite datetime 수식)
  const addImages = (itemId, count, when) => {
    const stmt = DB.raw.prepare(`INSERT INTO item_images(item_id,object_key,image_url,created_at) VALUES(?,?,?,datetime('now', ?))`)
    for (let i = 0; i < count; i++) stmt.run(itemId, `seed/${itemId}/${when}/${i}/${Math.random()}`, 'https://images.example/x', when)
  }

  // 1) 하루 업로드 수: 최근 24시간 안에 200장을 올렸으면 429, 이틀 전 사진은 세지 않는다
  const holders = []
  for (let i = 0; i < 25; i++) holders.push(await newItem(a, mine, `보관${i}`))
  for (const h of holders.slice(0, 20)) addImages(h.id, 9, '-2 days') // 오래된 사진 180장
  const target = await newItem(a, mine, '새 물건')
  assert.equal((await upload(a, target.id)).status, 201)
  for (const h of holders.slice(20, 25)) addImages(h.id, 8, '-1 hour') // 최근 40장
  for (const h of holders.slice(0, 20)) addImages(h.id, 1, '-2 hours') // 최근 20장 (물건당 10장째)
  const extra = []
  for (let i = 0; i < 14; i++) { const it = await newItem(a, mine, `추가${i}`); addImages(it.id, 10, '-3 hours'); extra.push(it) } // 최근 140장 → 합계 201장
  const limited = await upload(a, target.id)
  assert.equal(limited.status, 429)
  assert.equal(limited.code, 'UPLOAD_RATE_LIMIT')

  // 다른 사용자는 영향받지 않는다
  const bItem = await newItem(b, theirs, 'B 물건')
  assert.equal((await upload(b, bItem.id)).status, 201)

  // 2) 총량: 오래된 사진만으로 1,000장을 채우면 IMAGE_QUOTA
  DB.raw.prepare(`UPDATE item_images SET created_at = datetime('now','-10 days') WHERE item_id IN (SELECT id FROM items WHERE user_id=?)`).run(a.id)
  const have = DB.raw.prepare('SELECT count(*) n FROM item_images ii JOIN items i ON i.id=ii.item_id WHERE i.user_id=?').get(a.id).n
  let remaining = 1000 - have
  while (remaining > 0) { const it = await newItem(a, mine, '채우기'); const n = Math.min(10, remaining); addImages(it.id, n, '-10 days'); remaining -= n }
  const full = await upload(a, target.id)
  assert.equal(full.status, 422)
  assert.equal(full.code, 'IMAGE_QUOTA')
  // 사진 하나를 지우면 다시 올릴 수 있다
  const one = (await a.call('GET', `/items/${target.id}`)).data.images[0]
  assert.equal((await a.call('DELETE', `/items/${target.id}/images/${one.id}`)).status, 200)
  assert.equal((await upload(a, target.id)).status, 201)

  // 3) 물건 수: 3,000개를 채우면 ITEM_QUOTA
  const count = DB.raw.prepare('SELECT count(*) n FROM items WHERE user_id=?').get(a.id).n
  const insert = DB.raw.prepare('INSERT INTO items(user_id,home_id,name) VALUES(?,?,?)')
  for (let i = count; i < 3000; i++) insert.run(a.id, mine.home.id, `대량${i}`)
  const overItems = await a.call('POST', '/items', { homeId: mine.home.id, roomId: mine.room.id, name: '3001번째' })
  assert.equal(overItems.status, 422)
  assert.equal(overItems.code, 'ITEM_QUOTA')
  assert.equal((await a.call('PUT', `/items/${target.id}`, { homeId: mine.home.id, roomId: mine.room.id, name: '수정은 가능' })).status, 200)
})

test('보관장소 옮기기: 다른 보관장소 안의 수납공간이 되고 물건과 수납공간이 따라간다', async () => {
  const { user, DB, IMAGES } = setup()
  const a = await user('A')
  const b = await user('B')
  const home = (await a.call('POST', '/homes', { name: '우리집' })).data
  const kitchen = (await a.call('POST', `/homes/${home.id}/rooms`, { name: '주방' })).data
  const fridge = (await a.call('POST', `/homes/${home.id}/rooms`, { name: '냉장고' })).data
  const otherRoom = (await a.call('POST', `/homes/${home.id}/rooms`, { name: '안방' })).data
  const sink = (await a.call('POST', `/rooms/${kitchen.id}/storage-locations`, { name: '싱크대' })).data
  const door = (await a.call('POST', `/rooms/${fridge.id}/storage-locations`, { name: '문 칸' })).data
  const eggTray = (await a.call('POST', `/rooms/${fridge.id}/storage-locations`, { name: '계란 칸', parentId: door.id })).data

  const item = (name, extra) => a.call('POST', '/items', { homeId: home.id, roomId: fridge.id, name, ...extra }).then((r) => r.data)
  const milk = await item('우유') // 냉장고에 바로 둔 물건
  const egg = await item('계란', { storageLocationId: eggTray.id })
  const sponge = (await a.call('POST', '/items', { homeId: home.id, roomId: kitchen.id, name: '수세미', storageLocationId: sink.id })).data
  const passport = (await a.call('POST', '/items', { homeId: home.id, roomId: otherRoom.id, name: '여권' })).data
  const photo = await a.call('POST', `/items/${milk.id}/images`, undefined, { form: imageForm() })

  // 옮길 수 없는 경우
  assert.equal((await a.call('POST', `/rooms/${fridge.id}/move-into`, { targetRoomId: fridge.id })).code, 'ROOM_MOVE_INVALID')
  assert.equal((await a.call('POST', `/rooms/${fridge.id}/move-into`, {})).status, 422)
  const home2 = (await a.call('POST', '/homes', { name: '부모님 집' })).data
  const farRoom = (await a.call('POST', `/homes/${home2.id}/rooms`, { name: '창고' })).data
  assert.equal((await a.call('POST', `/rooms/${fridge.id}/move-into`, { targetRoomId: farRoom.id })).code, 'ROOM_MOVE_INVALID')
  const bHome = (await b.call('POST', '/homes', { name: 'B집' })).data
  const bRoom = (await b.call('POST', `/homes/${bHome.id}/rooms`, { name: 'B방' })).data
  assert.equal((await a.call('POST', `/rooms/${fridge.id}/move-into`, { targetRoomId: bRoom.id })).code, 'ROOM_MOVE_INVALID')
  assert.equal((await b.call('POST', `/rooms/${fridge.id}/move-into`, { targetRoomId: bRoom.id })).status, 404)

  // 냉장고 → 주방 안으로
  const moved = await a.call('POST', `/rooms/${fridge.id}/move-into`, { targetRoomId: kitchen.id })
  assert.equal(moved.status, 200)
  assert.equal(moved.data.roomId, kitchen.id)
  assert.equal(moved.data.fullPath, '냉장고')
  const fridgeStorageId = moved.data.id

  // 냉장고 보관장소는 없어지고 주방만 남는다
  const rooms = (await a.call('GET', `/homes/${home.id}/rooms`)).data.map((r) => r.name)
  assert.deepEqual(rooms.sort(), ['안방', '주방'])
  assert.equal((await a.call('GET', `/rooms/${fridge.id}`)).status, 404)

  // 주방의 수납공간 트리: 싱크대, 냉장고 > 문 칸 > 계란 칸
  const tree = (await a.call('GET', `/rooms/${kitchen.id}/storage-locations`)).data
  const fridgeNode = tree.find((n) => n.name === '냉장고')
  assert.deepEqual(tree.map((n) => n.name).sort(), ['냉장고', '싱크대'])
  assert.deepEqual(fridgeNode.children.map((n) => n.name), ['문 칸'])
  assert.deepEqual(fridgeNode.children[0].children.map((n) => n.name), ['계란 칸'])

  // 물건: 방은 주방으로, 위치 경로는 냉장고 아래로
  const milkAfter = (await a.call('GET', `/items/${milk.id}`)).data
  assert.equal(milkAfter.roomId, kitchen.id)
  assert.equal(milkAfter.roomName, '주방')
  assert.equal(milkAfter.storageLocationId, fridgeStorageId)
  assert.equal(milkAfter.storageFullPath, '냉장고')
  assert.equal(milkAfter.images.length, 1) // 사진은 그대로
  assert.ok(IMAGES.objects.has(new URL(photo.data.imageUrl).pathname.slice(1)))
  const eggAfter = (await a.call('GET', `/items/${egg.id}`)).data
  assert.equal(eggAfter.roomId, kitchen.id)
  assert.equal(eggAfter.storageLocationId, eggTray.id)
  assert.equal(eggAfter.storageFullPath, '냉장고 > 문 칸 > 계란 칸')

  // 다른 물건은 그대로
  assert.equal((await a.call('GET', `/items/${sponge.id}`)).data.storageFullPath, '싱크대')
  assert.equal((await a.call('GET', `/items/${passport.id}`)).data.roomId, otherRoom.id)
  assert.equal(DB.raw.prepare('SELECT count(*) n FROM items WHERE user_id=?').get(a.id).n, 4)
})
