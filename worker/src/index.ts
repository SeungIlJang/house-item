import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types.ts'
import { ApiError, fail, ok } from './lib/http.ts'
import { verifyToken } from './lib/jwt.ts'
import { requestLang, toEnglish } from './lib/i18n.ts'
import { registerAuthRoutes } from './routes/auth.ts'
import { registerUserRoutes } from './routes/users.ts'
import { registerHomeRoutes } from './routes/homes.ts'
import { registerStorageRoutes } from './routes/storage.ts'
import { registerTaxonomyRoutes } from './routes/taxonomy.ts'
import { registerItemRoutes } from './routes/items.ts'
import { registerVisionRoutes } from './routes/vision.ts'

const app = new Hono<AppEnv>()

app.use('*', async (c, next) => cors({
  origin: (origin) => c.env.CORS_ORIGINS.split(',').map((v) => v.trim()).includes(origin) ? origin : '',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  // 앱은 서버와 주소가 달라 브라우저가 요청마다 사전 확인(OPTIONS)을 먼저 보낸다. 그 결과를 기억하게 해
  // 같은 주소의 다음 요청부터는 바로 보내게 한다(브라우저마다 상한이 있다. 크롬·안드로이드 WebView 는 2시간).
  maxAge: 86400,
})(c, next))

// 서버 문구는 한국어로 쓴다. 영어 화면(Accept-Language 가 한국어가 아님)에는 내보내기 직전에 영어로 바꾼다(lib/i18n.ts).
// 문구는 오류 응답에만 실리므로(탈퇴 완료만 예외) 정상 응답은 건드리지 않아 느려지지 않는다.
app.use('*', async (c, next) => {
  await next()
  if (requestLang(c.req.header('Accept-Language')) === 'ko') return
  const isAccountDeletion = c.req.method === 'DELETE' && c.req.path === '/api/v1/users/me'
  if (c.res.status < 400 && !isAccountDeletion) return
  if (!c.res.headers.get('Content-Type')?.includes('application/json')) return
  const status = c.res.status
  const body = await c.res.clone().json<{ message?: unknown }>().catch(() => null)
  if (!body || typeof body.message !== 'string') return
  c.res = c.json({ ...body, message: toEnglish(body.message) }, status as 400)
})

app.use('/api/v1/*', async (c, next) => {
  if (c.req.path.startsWith('/api/v1/auth/')) return next()
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  const userId = token ? await verifyToken(token, c.env.JWT_SECRET_KEY) : null
  if (!userId) return c.json(fail('인증이 필요합니다.', 'NOT_AUTHENTICATED'), 401)
  c.set('userId', userId)
  // 탈퇴한 사용자의 토큰은 만료 전이라도 받지 않는다.
  const exists = c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
  const userNotFound = () => c.json(fail('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'), 401)
  if (c.req.method !== 'GET') {
    if (!(await exists)) return userNotFound()
    return next()
  }
  // 조회(GET)는 아무것도 바꾸지 않으므로, 사용자 확인이 끝나기를 기다리지 않고 조회를 함께 시작한다.
  // DB 를 한 번 다녀오는 데 0.1초 넘게 걸려서(서버와 DB 가 멀다) 차례로 하면 그만큼 늦어진다.
  // 사용자가 없으면 조회 결과는 버리고 401 로 바꾼다.
  const [user] = await Promise.all([exists, next()])
  if (!user) c.res = userNotFound()
})

app.get('/health', (c) => c.json(ok({ status: 'ok', env: c.env.APP_ENV })))
app.get('/health/db', async (c) => { await c.env.DB.prepare('SELECT 1').first(); return c.json(ok({ database: 'ok' })) })

registerAuthRoutes(app)
registerUserRoutes(app)
registerHomeRoutes(app)
registerStorageRoutes(app)
registerTaxonomyRoutes(app)
registerItemRoutes(app)
registerVisionRoutes(app)

app.onError((error, c) => {
  if (error instanceof ApiError) return c.json(fail(error.message, error.code), error.status)
  console.error(error)
  return c.json(fail('서버 오류가 발생했습니다.', 'INTERNAL_ERROR'), 500)
})
app.notFound((c) => c.json(fail('요청한 API를 찾을 수 없습니다.', 'NOT_FOUND'), 404))
export default app
