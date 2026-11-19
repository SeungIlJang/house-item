import type { App, Row } from '../types.ts'
import { ok, readBody, ApiError, notFoundError } from '../lib/http.ts'
import { text, pathId } from '../lib/validate.ts'
import { entityJson } from '../lib/json.ts'
import { requireOwned } from '../lib/owned.ts'

export function registerTaxonomyRoutes(app: App) {
  // ──────────────────────────────────────────────────────────────
  // 카테고리 · 태그
  // ──────────────────────────────────────────────────────────────

  const simpleRoutes = (path: string, table: 'categories' | 'tags', label: string) => {
    const nameOf = (b: Row) => text(b.name, `${label} 이름`, { required: true, max: 50 })!
    const duplicate = () => new ApiError(409, 'DUPLICATE_NAME', '이미 같은 이름이 있습니다.')
    const isUniqueViolation = (error: unknown) => String((error as Error)?.message ?? error).includes('UNIQUE')

    app.get(`/api/v1/${path}`, async (c) => {
      const { results } = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE user_id=? ORDER BY name`).bind(c.get('userId')).all<Row>()
      return c.json(ok(results.map(entityJson)))
    })
    app.post(`/api/v1/${path}`, async (c) => {
      const name = nameOf(await readBody(c))
      try {
        const row = await c.env.DB.prepare(`INSERT INTO ${table}(user_id,name) VALUES(?,?) RETURNING *`).bind(c.get('userId'), name).first<Row>()
        return c.json(ok(entityJson(row!)), 201)
      } catch (error) {
        if (isUniqueViolation(error)) throw duplicate()
        throw error
      }
    })
    app.put(`/api/v1/${path}/:id`, async (c) => {
      const id = pathId(c)
      await requireOwned(c.env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND user_id=?`).bind(id, c.get('userId')).first())
      const name = nameOf(await readBody(c))
      try {
        const row = await c.env.DB.prepare(`UPDATE ${table} SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *`).bind(name, id).first<Row>()
        return c.json(ok(entityJson(row!)))
      } catch (error) {
        if (isUniqueViolation(error)) throw duplicate()
        throw error
      }
    })
    app.delete(`/api/v1/${path}/:id`, async (c) => {
      const r = await c.env.DB.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).bind(pathId(c), c.get('userId')).run()
      if (!r.meta.changes) throw notFoundError()
      return c.json(ok())
    })
  }
  simpleRoutes('categories', 'categories', '카테고리')
  simpleRoutes('tags', 'tags', '태그')
}
