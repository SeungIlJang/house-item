import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
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
  APP_REDIRECT_URI: string // 예: com.homeitems.app://auth
}
type Variables = { userId: number }
type Row = Record<string, any>

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
const ok = (data: unknown = null, message: string | null = null) => ({ success: true, data, message })
const fail = (message: string, errorCode: string) => ({ success: false, data: null, message, errorCode })
const b64url = (value: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
const fromB64url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
const sign = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
}
const makeToken = async (userId: number, secret: string, remember = true) => {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ sub: String(userId), exp: Math.floor(Date.now() / 1000) + (remember ? 2592000 : 3600) }))
  const body = `${header}.${payload}`
  return `${body}.${await sign(body, secret)}`
}
const verifyToken = async (token: string, secret: string) => {
  const parts = token.split('.')
  if (parts.length !== 3 || await sign(`${parts[0]}.${parts[1]}`, secret) !== parts[2]) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])))
    return payload.exp > Date.now() / 1000 ? Number(payload.sub) : null
  } catch { return null }
}
const userJson = (row: Row) => ({ id: row.id, email: row.email ?? null, name: row.name, avatarUrl: row.avatar_url ?? null, createdAt: row.created_at })
const entityJson = (row: Row) => ({ id: row.id, name: row.name, description: row.description ?? null, createdAt: row.created_at, updatedAt: row.updated_at })

app.use('*', async (c, next) => cors({
  origin: (origin) => c.env.CORS_ORIGINS.split(',').map((v) => v.trim()).includes(origin) ? origin : '',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
})(c, next))

app.use('/api/v1/*', async (c, next) => {
  if (c.req.path.startsWith('/api/v1/auth/')) return next()
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  const userId = token ? await verifyToken(token, c.env.JWT_SECRET_KEY) : null
  if (!userId) return c.json(fail('인증이 필요합니다.', 'NOT_AUTHENTICATED'), 401)
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
  if (!user) return c.json(fail('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'), 401)
  c.set('userId', userId)
  return next()
})

app.get('/health', (c) => c.json(ok({ status: 'ok', env: c.env.APP_ENV })))
app.get('/health/db', async (c) => { await c.env.DB.prepare('SELECT 1').first(); return c.json(ok({ database: 'ok' })) })

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
      email: p.email ?? null,
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
    email: account.email ?? null,
    avatarUrl: profile.profile_image_url ?? null,
  }
}

// 기존 식별자가 있으면 그 계정, 없으면 같은 이메일 계정에 연결, 그것도 없으면 신규 생성.
const resolveUser = async (c: any, provider: ProviderName, profile: ProviderProfile) => {
  const identity = await c.env.DB
    .prepare('SELECT user_id FROM auth_identities WHERE provider=? AND provider_user_id=?')
    .bind(provider, profile.providerUserId).first<Row>()
  if (identity) return Number(identity.user_id)

  let userId: number | null = null
  if (profile.email) {
    const existing = await c.env.DB
      .prepare('SELECT id FROM users WHERE email IS NOT NULL AND lower(email)=lower(?)')
      .bind(profile.email).first<Row>()
    if (existing) userId = Number(existing.id)
  }

  if (userId === null) {
    const created = await c.env.DB
      .prepare('INSERT INTO users(email,name,avatar_url) VALUES(?,?,?)')
      .bind(profile.email, profile.name, profile.avatarUrl).run()
    userId = Number(created.meta.last_row_id)
  }

  await c.env.DB
    .prepare('INSERT INTO auth_identities(user_id,provider,provider_user_id) VALUES(?,?,?)')
    .bind(userId, provider, profile.providerUserId).run()
  return userId
}

const appRedirect = (c: any, params: Record<string, string>) => {
  const target = new URL(c.env.APP_REDIRECT_URI)
  for (const [k, val] of Object.entries(params)) target.searchParams.set(k, val)
  return c.redirect(target.toString(), 302)
}

app.get('/api/v1/auth/:provider/start', async (c) => {
  const provider = c.req.param('provider') as ProviderName
  if (provider !== 'google' && provider !== 'kakao') return c.json(fail('지원하지 않는 로그인입니다.', 'UNSUPPORTED_PROVIDER'), 404)

  const cfg = providerConfig(c, provider)
  if (!cfg.clientId) return c.json(fail('로그인 설정이 준비되지 않았습니다.', 'PROVIDER_NOT_CONFIGURED'), 503)

  const state = randomUrlSafe(16)
  const verifier = randomUrlSafe(32)
  await c.env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(Math.floor(Date.now() / 1000)).run()
  await c.env.DB
    .prepare('INSERT INTO oauth_states(state,provider,code_verifier,expires_at) VALUES(?,?,?,?)')
    .bind(state, provider, verifier, Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS).run()

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
  if (c.req.query('error') || !code || !state) return appRedirect(c, { error: 'ACCESS_DENIED' })

  // state 는 1회용. 조회 즉시 삭제해 재사용을 막는다.
  const saved = await c.env.DB.prepare('SELECT * FROM oauth_states WHERE state=?').bind(state).first<Row>()
  if (saved) await c.env.DB.prepare('DELETE FROM oauth_states WHERE state=?').bind(state).run()
  if (!saved || saved.provider !== provider || Number(saved.expires_at) < Math.floor(Date.now() / 1000)) {
    return appRedirect(c, { error: 'INVALID_STATE' })
  }

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
    if (!tokenRes.ok) return appRedirect(c, { error: 'TOKEN_EXCHANGE_FAILED' })
    const token = await tokenRes.json<Row>()
    if (!token.access_token) return appRedirect(c, { error: 'TOKEN_EXCHANGE_FAILED' })

    const profile = await fetchProfile(provider, token.access_token)
    const userId = await resolveUser(c, provider, profile)
    const accessToken = await makeToken(userId, c.env.JWT_SECRET_KEY, true)
    return appRedirect(c, { token: accessToken })
  } catch {
    return appRedirect(c, { error: 'LOGIN_FAILED' })
  }
})
app.get('/api/v1/users/me', async (c) => {
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.get('userId')).first<Row>()
  return c.json(ok(userJson(user!)))
})

const ownedHome = (db: D1Database, id: number, userId: number) => db.prepare('SELECT * FROM homes WHERE id=? AND user_id=?').bind(id, userId).first<Row>()
const ownedRoom = (db: D1Database, id: number, userId: number) => db.prepare('SELECT r.* FROM rooms r JOIN homes h ON h.id=r.home_id WHERE r.id=? AND h.user_id=?').bind(id, userId).first<Row>()
const ownedStorage = (db: D1Database, id: number, userId: number) => db.prepare('SELECT s.* FROM storage_locations s JOIN rooms r ON r.id=s.room_id JOIN homes h ON h.id=r.home_id WHERE s.id=? AND h.user_id=?').bind(id, userId).first<Row>()
const notFound = (c: any) => c.json(fail('대상을 찾을 수 없습니다.', 'NOT_FOUND'), 404)

app.get('/api/v1/homes', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM homes WHERE user_id=? ORDER BY id').bind(c.get('userId')).all<Row>()
  return c.json(ok(results.map(entityJson)))
})
app.post('/api/v1/homes', async (c) => {
  const b = await c.req.json<Row>(); const r = await c.env.DB.prepare('INSERT INTO homes(user_id,name,description) VALUES(?,?,?)').bind(c.get('userId'), b.name, b.description ?? null).run()
  const row = await ownedHome(c.env.DB, Number(r.meta.last_row_id), c.get('userId')); return c.json(ok(entityJson(row!)), 201)
})
app.get('/api/v1/homes/:id', async (c) => { const row = await ownedHome(c.env.DB, Number(c.req.param('id')), c.get('userId')); return row ? c.json(ok(entityJson(row))) : notFound(c) })
app.put('/api/v1/homes/:id', async (c) => { const id=Number(c.req.param('id')); if(!await ownedHome(c.env.DB,id,c.get('userId'))) return notFound(c); const b=await c.req.json<Row>(); await c.env.DB.prepare('UPDATE homes SET name=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.name,b.description??null,id).run(); return c.json(ok(entityJson((await ownedHome(c.env.DB,id,c.get('userId')))!))) })
app.delete('/api/v1/homes/:id', async (c) => { const id=Number(c.req.param('id')); if(!await ownedHome(c.env.DB,id,c.get('userId'))) return notFound(c); await c.env.DB.prepare('DELETE FROM homes WHERE id=?').bind(id).run(); return c.json(ok()) })

const roomJson = (r: Row) => ({ ...entityJson(r), homeId:r.home_id, sortOrder:r.sort_order })
app.get('/api/v1/homes/:id/rooms', async (c) => { const id=Number(c.req.param('id')); if(!await ownedHome(c.env.DB,id,c.get('userId'))) return notFound(c); const {results}=await c.env.DB.prepare('SELECT * FROM rooms WHERE home_id=? ORDER BY sort_order,id').bind(id).all<Row>(); return c.json(ok(results.map(roomJson))) })
app.post('/api/v1/homes/:id/rooms', async (c) => { const id=Number(c.req.param('id')); if(!await ownedHome(c.env.DB,id,c.get('userId'))) return notFound(c); const b=await c.req.json<Row>(); const r=await c.env.DB.prepare('INSERT INTO rooms(home_id,name,description,sort_order) VALUES(?,?,?,?)').bind(id,b.name,b.description??null,b.sortOrder??0).run(); return c.json(ok(roomJson((await ownedRoom(c.env.DB,Number(r.meta.last_row_id),c.get('userId')))!)),201) })
app.get('/api/v1/rooms/:id', async (c) => { const row=await ownedRoom(c.env.DB,Number(c.req.param('id')),c.get('userId')); return row?c.json(ok(roomJson(row))):notFound(c) })
app.put('/api/v1/rooms/:id', async (c) => { const id=Number(c.req.param('id')); if(!await ownedRoom(c.env.DB,id,c.get('userId'))) return notFound(c); const b=await c.req.json<Row>(); await c.env.DB.prepare('UPDATE rooms SET name=?,description=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.name,b.description??null,b.sortOrder??0,id).run(); return c.json(ok(roomJson((await ownedRoom(c.env.DB,id,c.get('userId')))!))) })
app.delete('/api/v1/rooms/:id', async (c) => { const id=Number(c.req.param('id')); if(!await ownedRoom(c.env.DB,id,c.get('userId'))) return notFound(c); await c.env.DB.prepare('DELETE FROM rooms WHERE id=?').bind(id).run(); return c.json(ok()) })

const storageJson = async (db:D1Database,row:Row) => { const names=[row.name]; let p=row.parent_id; while(p){const r=await db.prepare('SELECT id,parent_id,name FROM storage_locations WHERE id=?').bind(p).first<Row>(); if(!r)break; names.unshift(r.name); p=r.parent_id} return {id:row.id,roomId:row.room_id,parentId:row.parent_id??null,name:row.name,description:row.description??null,sortOrder:row.sort_order,fullPath:names.join(' > '),createdAt:row.created_at,updatedAt:row.updated_at} }
const tree = (rows:Row[]) => { const map=new Map<number,any>(); rows.forEach(r=>map.set(r.id,{id:r.id,roomId:r.room_id,parentId:r.parent_id??null,name:r.name,description:r.description??null,sortOrder:r.sort_order,children:[]})); const roots:any[]=[]; map.forEach(n=>n.parentId&&map.has(n.parentId)?map.get(n.parentId).children.push(n):roots.push(n)); return roots }
app.get('/api/v1/rooms/:id/storage-locations', async(c)=>{const id=Number(c.req.param('id'));if(!await ownedRoom(c.env.DB,id,c.get('userId')))return notFound(c);const {results}=await c.env.DB.prepare('SELECT * FROM storage_locations WHERE room_id=? ORDER BY sort_order,id').bind(id).all<Row>();return c.json(ok(tree(results)))})
app.post('/api/v1/rooms/:id/storage-locations', async(c)=>{const id=Number(c.req.param('id'));if(!await ownedRoom(c.env.DB,id,c.get('userId')))return notFound(c);const b=await c.req.json<Row>();const r=await c.env.DB.prepare('INSERT INTO storage_locations(room_id,parent_id,name,description,sort_order) VALUES(?,?,?,?,?)').bind(id,b.parentId??null,b.name,b.description??null,b.sortOrder??0).run();return c.json(ok(await storageJson(c.env.DB,(await ownedStorage(c.env.DB,Number(r.meta.last_row_id),c.get('userId')))!)),201)})
app.get('/api/v1/storage-locations/:id',async(c)=>{const r=await ownedStorage(c.env.DB,Number(c.req.param('id')),c.get('userId'));return r?c.json(ok(await storageJson(c.env.DB,r))):notFound(c)})
app.put('/api/v1/storage-locations/:id',async(c)=>{const id=Number(c.req.param('id'));if(!await ownedStorage(c.env.DB,id,c.get('userId')))return notFound(c);const b=await c.req.json<Row>();await c.env.DB.prepare('UPDATE storage_locations SET name=?,parent_id=?,description=coalesce(?,description),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.name,b.parentId??null,b.description??null,id).run();return c.json(ok(await storageJson(c.env.DB,(await ownedStorage(c.env.DB,id,c.get('userId')))!)))})
app.delete('/api/v1/storage-locations/:id',async(c)=>{const id=Number(c.req.param('id'));if(!await ownedStorage(c.env.DB,id,c.get('userId')))return notFound(c);await c.env.DB.prepare('DELETE FROM storage_locations WHERE id=?').bind(id).run();return c.json(ok())})

const simpleRoutes = (path:string, table:string) => {
  app.get(`/api/v1/${path}`,async(c)=>{const {results}=await c.env.DB.prepare(`SELECT * FROM ${table} WHERE user_id=? ORDER BY name`).bind(c.get('userId')).all<Row>();return c.json(ok(results.map(entityJson)))})
  app.post(`/api/v1/${path}`,async(c)=>{const b=await c.req.json<Row>();try{const r=await c.env.DB.prepare(`INSERT INTO ${table}(user_id,name) VALUES(?,?)`).bind(c.get('userId'),b.name).run();const row=await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(r.meta.last_row_id).first<Row>();return c.json(ok(entityJson(row!)),201)}catch{return c.json(fail('이미 같은 이름이 있습니다.','DUPLICATE_NAME'),409)}})
  app.put(`/api/v1/${path}/:id`,async(c)=>{const id=Number(c.req.param('id'));const own=await c.env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND user_id=?`).bind(id,c.get('userId')).first();if(!own)return notFound(c);const b=await c.req.json<Row>();await c.env.DB.prepare(`UPDATE ${table} SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(b.name,id).run();const row=await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first<Row>();return c.json(ok(entityJson(row!)))})
  app.delete(`/api/v1/${path}/:id`,async(c)=>{const r=await c.env.DB.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).bind(Number(c.req.param('id')),c.get('userId')).run();return r.meta.changes?c.json(ok()):notFound(c)})
}
simpleRoutes('categories','categories'); simpleRoutes('tags','tags')

const itemJson = async(db:D1Database,row:Row)=>{const {results:tags}=await db.prepare('SELECT t.* FROM tags t JOIN item_tags it ON it.tag_id=t.id WHERE it.item_id=? ORDER BY t.name').bind(row.id).all<Row>();const {results:images}=await db.prepare('SELECT * FROM item_images WHERE item_id=? ORDER BY sort_order,id').bind(row.id).all<Row>();let fullPath=null;if(row.storage_location_id){const s=await db.prepare('SELECT * FROM storage_locations WHERE id=?').bind(row.storage_location_id).first<Row>();if(s)fullPath=(await storageJson(db,s)).fullPath}return{id:row.id,name:row.name,description:row.description??null,quantity:row.quantity,memo:row.memo??null,purchaseDate:row.purchase_date??null,expirationDate:row.expiration_date??null,homeId:row.home_id,roomId:row.room_id??null,storageLocationId:row.storage_location_id??null,categoryId:row.category_id??null,categoryName:row.category_name??null,roomName:row.room_name??null,storageFullPath:fullPath,tags:tags.map(entityJson),images:images.map(i=>({id:i.id,imageUrl:i.image_url,originalFilename:i.original_filename,sortOrder:i.sort_order,createdAt:i.created_at})),thumbnailUrl:images[0]?.image_url??null,createdAt:row.created_at,updatedAt:row.updated_at}}
const itemBase='SELECT i.*,c.name category_name,r.name room_name FROM items i LEFT JOIN categories c ON c.id=i.category_id LEFT JOIN rooms r ON r.id=i.room_id'
const ownedItem=(db:D1Database,id:number,userId:number)=>db.prepare(`${itemBase} WHERE i.id=? AND i.user_id=?`).bind(id,userId).first<Row>()
const listItems=async(c:any,_search:boolean)=>{const q=c.req.query();const where=['i.user_id=?'];const vals:any[]=[c.get('userId')];for(const [key,col] of [['home_id','i.home_id'],['room_id','i.room_id'],['storage_location_id','i.storage_location_id'],['category_id','i.category_id']] as const)if(q[key]){where.push(`${col}=?`);vals.push(Number(q[key]))}if(q.keyword){where.push('(i.name LIKE ? OR i.description LIKE ? OR i.memo LIKE ?)');vals.push(...Array(3).fill(`%${q.keyword}%`))}if(q.tag_id){where.push('EXISTS(SELECT 1 FROM item_tags it WHERE it.item_id=i.id AND it.tag_id=?)');vals.push(Number(q.tag_id))}const page=Math.max(1,Number(q.page||1)),size=Math.min(100,Math.max(1,Number(q.size||20)));const count=await c.env.DB.prepare(`SELECT count(*) total FROM items i WHERE ${where.join(' AND ')}`).bind(...vals).first() as Row|null;const order=q.sort==='name'?'i.name':'i.created_at DESC';const queryResult=await c.env.DB.prepare(`${itemBase} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...vals,size,(page-1)*size).all();const content=[];for(const row of queryResult.results as Row[])content.push(await itemJson(c.env.DB,row));return c.json(ok({content,page,size,totalElements:count!.total,totalPages:Math.ceil(count!.total/size)}))}
app.get('/api/v1/items',c=>listItems(c,false));app.get('/api/v1/items/search',c=>listItems(c,true))
app.get('/api/v1/items/:id',async(c)=>{const row=await ownedItem(c.env.DB,Number(c.req.param('id')),c.get('userId'));return row?c.json(ok(await itemJson(c.env.DB,row))):notFound(c)})
const saveTags=async(db:D1Database,itemId:number,ids:number[])=>{await db.prepare('DELETE FROM item_tags WHERE item_id=?').bind(itemId).run();if(ids.length)await db.batch(ids.map(id=>db.prepare('INSERT OR IGNORE INTO item_tags(item_id,tag_id) VALUES(?,?)').bind(itemId,id)))}
app.post('/api/v1/items',async(c)=>{const b=await c.req.json<Row>();if(!await ownedHome(c.env.DB,b.homeId,c.get('userId')))return c.json(fail('집을 찾을 수 없습니다.','INVALID_HOME'),422);const r=await c.env.DB.prepare('INSERT INTO items(user_id,home_id,room_id,storage_location_id,category_id,name,description,quantity,memo,purchase_date,expiration_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(c.get('userId'),b.homeId,b.roomId??null,b.storageLocationId??null,b.categoryId??null,b.name,b.description??null,b.quantity??1,b.memo??null,b.purchaseDate??null,b.expirationDate??null).run();await saveTags(c.env.DB,Number(r.meta.last_row_id),b.tagIds??[]);const row=await ownedItem(c.env.DB,Number(r.meta.last_row_id),c.get('userId'));return c.json(ok(await itemJson(c.env.DB,row!)),201)})
app.put('/api/v1/items/:id',async(c)=>{const id=Number(c.req.param('id'));if(!await ownedItem(c.env.DB,id,c.get('userId')))return notFound(c);const b=await c.req.json<Row>();await c.env.DB.prepare('UPDATE items SET home_id=?,room_id=?,storage_location_id=?,category_id=?,name=?,description=?,quantity=?,memo=?,purchase_date=?,expiration_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.homeId,b.roomId??null,b.storageLocationId??null,b.categoryId??null,b.name,b.description??null,b.quantity??1,b.memo??null,b.purchaseDate??null,b.expirationDate??null,id).run();await saveTags(c.env.DB,id,b.tagIds??[]);return c.json(ok(await itemJson(c.env.DB,(await ownedItem(c.env.DB,id,c.get('userId')))!)))})
app.delete('/api/v1/items/:id',async(c)=>{const id=Number(c.req.param('id'));if(!await ownedItem(c.env.DB,id,c.get('userId')))return notFound(c);const {results}=await c.env.DB.prepare('SELECT object_key FROM item_images WHERE item_id=?').bind(id).all<Row>();await Promise.all(results.map(x=>c.env.IMAGES.delete(x.object_key)));await c.env.DB.prepare('DELETE FROM items WHERE id=?').bind(id).run();return c.json(ok())})
app.post('/api/v1/items/:id/images',async(c)=>{const itemId=Number(c.req.param('id'));if(!await ownedItem(c.env.DB,itemId,c.get('userId')))return notFound(c);const form=await c.req.formData();const file=form.get('file');if(!(file instanceof File))return c.json(fail('이미지 파일이 필요합니다.','INVALID_FILE'),422);if(file.size>10*1024*1024)return c.json(fail('이미지는 10MB 이하여야 합니다.','FILE_TOO_LARGE'),413);const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();const key=`items/${c.get('userId')}/${itemId}/${crypto.randomUUID()}.${ext}`;await c.env.IMAGES.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'}});const url=`${c.env.R2_PUBLIC_BASE_URL.replace(/\/$/,'')}/${key}`;const r=await c.env.DB.prepare('INSERT INTO item_images(item_id,object_key,image_url,original_filename) VALUES(?,?,?,?)').bind(itemId,key,url,file.name).run();const row=await c.env.DB.prepare('SELECT * FROM item_images WHERE id=?').bind(r.meta.last_row_id).first<Row>();return c.json(ok({id:row!.id,imageUrl:row!.image_url,originalFilename:row!.original_filename,sortOrder:row!.sort_order,createdAt:row!.created_at}),201)})
app.delete('/api/v1/items/:itemId/images/:imageId',async(c)=>{const itemId=Number(c.req.param('itemId'));if(!await ownedItem(c.env.DB,itemId,c.get('userId')))return notFound(c);const row=await c.env.DB.prepare('SELECT * FROM item_images WHERE id=? AND item_id=?').bind(Number(c.req.param('imageId')),itemId).first<Row>();if(!row)return notFound(c);await c.env.IMAGES.delete(row.object_key);await c.env.DB.prepare('DELETE FROM item_images WHERE id=?').bind(row.id).run();return c.json(ok())})

app.onError((error,c)=>{console.error(error);return c.json(fail('서버 오류가 발생했습니다.','INTERNAL_ERROR'),500)})
app.notFound((c)=>c.json(fail('요청한 API를 찾을 수 없습니다.','NOT_FOUND'),404))
export default app
