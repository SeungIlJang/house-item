import type { App, Row } from '../types.ts'
import { ok, readBody } from '../lib/http.ts'
import { text, integer, pathId } from '../lib/validate.ts'
import { entityJson } from '../lib/json.ts'
import { ownedHome, ownedRoom, requireOwned } from '../lib/owned.ts'
import { deleteObjects, imageKeys } from '../lib/cleanup.ts'

export function registerHomeRoutes(app: App) {
  // ──────────────────────────────────────────────────────────────
  // 집
  // ──────────────────────────────────────────────────────────────

  const homeInput = (b: Row) => ({
    name: text(b.name, '집 이름', { required: true, max: 100 })!,
    description: text(b.description, '설명', { max: 500 }),
  })

  app.get('/api/v1/homes', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM homes WHERE user_id=? ORDER BY id').bind(c.get('userId')).all<Row>()
    return c.json(ok(results.map(entityJson)))
  })
  app.post('/api/v1/homes', async (c) => {
    const input = homeInput(await readBody(c))
    const row = await c.env.DB.prepare('INSERT INTO homes(user_id,name,description) VALUES(?,?,?) RETURNING *')
      .bind(c.get('userId'), input.name, input.description).first<Row>()
    return c.json(ok(entityJson(row!)), 201)
  })
  app.get('/api/v1/homes/:id', async (c) => {
    const row = await requireOwned(ownedHome(c.env.DB, pathId(c), c.get('userId')))
    return c.json(ok(entityJson(row)))
  })
  app.put('/api/v1/homes/:id', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedHome(c.env.DB, id, c.get('userId')))
    const input = homeInput(await readBody(c))
    const row = await c.env.DB.prepare('UPDATE homes SET name=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *')
      .bind(input.name, input.description, id).first<Row>()
    return c.json(ok(entityJson(row!)))
  })
  app.delete('/api/v1/homes/:id', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedHome(c.env.DB, id, c.get('userId')))
    // 집을 지우면 그 집의 물건과 사진 기록이 CASCADE 로 지워지므로 R2 파일도 함께 지운다.
    // (방·수납공간 삭제는 물건을 지우지 않고 위치만 비우므로 사진 정리가 필요 없다.)
    const keys = await imageKeys(c.env.DB, 'i.home_id=?', id)
    await c.env.DB.prepare('DELETE FROM homes WHERE id=?').bind(id).run()
    await deleteObjects(c.env.IMAGES, keys)
    return c.json(ok())
  })

  // ──────────────────────────────────────────────────────────────
  // 방
  // ──────────────────────────────────────────────────────────────

  const roomJson = (r: Row) => ({ ...entityJson(r), homeId: r.home_id, sortOrder: r.sort_order })
  const roomInput = (b: Row) => ({
    name: text(b.name, '방 이름', { required: true, max: 100 })!,
    description: text(b.description, '설명', { max: 500 }),
    sortOrder: integer(b.sortOrder, '정렬 순서', 0),
  })

  app.get('/api/v1/homes/:id/rooms', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedHome(c.env.DB, id, c.get('userId')))
    const { results } = await c.env.DB.prepare('SELECT * FROM rooms WHERE home_id=? ORDER BY sort_order,id').bind(id).all<Row>()
    return c.json(ok(results.map(roomJson)))
  })
  app.post('/api/v1/homes/:id/rooms', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedHome(c.env.DB, id, c.get('userId')))
    const input = roomInput(await readBody(c))
    const row = await c.env.DB.prepare('INSERT INTO rooms(home_id,name,description,sort_order) VALUES(?,?,?,?) RETURNING *')
      .bind(id, input.name, input.description, input.sortOrder).first<Row>()
    return c.json(ok(roomJson(row!)), 201)
  })
  app.get('/api/v1/rooms/:id', async (c) => {
    const row = await requireOwned(ownedRoom(c.env.DB, pathId(c), c.get('userId')))
    return c.json(ok(roomJson(row)))
  })
  app.put('/api/v1/rooms/:id', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedRoom(c.env.DB, id, c.get('userId')))
    const input = roomInput(await readBody(c))
    const row = await c.env.DB.prepare('UPDATE rooms SET name=?,description=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *')
      .bind(input.name, input.description, input.sortOrder, id).first<Row>()
    return c.json(ok(roomJson(row!)))
  })
  app.delete('/api/v1/rooms/:id', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedRoom(c.env.DB, id, c.get('userId')))
    await c.env.DB.prepare('DELETE FROM rooms WHERE id=?').bind(id).run()
    return c.json(ok())
  })
}
