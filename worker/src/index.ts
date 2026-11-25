import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types.ts'
import { ApiError, fail, ok } from './lib/http.ts'
import { verifyToken } from './lib/jwt.ts'
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
