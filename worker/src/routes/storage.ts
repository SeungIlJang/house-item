import type { App, Row } from '../types.ts'
import { ok, readBody, invalid } from '../lib/http.ts'
import { text, integer, optionalId, pathId } from '../lib/validate.ts'
import { ownedRoom, ownedStorage, requireOwned } from '../lib/owned.ts'
import { MAX_STORAGE_DEPTH, storageJson } from '../lib/storagePaths.ts'

export function registerStorageRoutes(app: App) {
  const tree = (rows: Row[]) => {
    const map = new Map<number, any>()
    rows.forEach((r) => map.set(r.id, { id: r.id, roomId: r.room_id, parentId: r.parent_id ?? null, name: r.name, description: r.description ?? null, sortOrder: r.sort_order, children: [] }))
    const roots: any[] = []
    map.forEach((n) => (n.parentId && map.has(n.parentId) ? map.get(n.parentId).children.push(n) : roots.push(n)))
    return roots
  }

  /** 상위 수납공간은 같은 방에 있어야 한다. 다른 사용자의 수납공간 ID 도 여기서 걸러진다. */
  const assertParentInRoom = async (db: D1Database, parentId: number, roomId: number) => {
    const parent = await db.prepare('SELECT id FROM storage_locations WHERE id=? AND room_id=?').bind(parentId, roomId).first()
    if (!parent) throw invalid('상위 수납공간이 같은 방에 있지 않습니다.', 'STORAGE_PARENT_INVALID')
  }

  /** 자기 자신이나 자손을 상위로 지정하면 경로가 끝없이 이어지므로 막는다. */
  const assertNoCycle = async (db: D1Database, storageId: number, newParentId: number) => {
    if (storageId === newParentId) throw invalid('자기 자신을 상위로 지정할 수 없습니다.', 'STORAGE_CYCLE')
    const hit = await db.prepare(`
      WITH RECURSIVE anc(id, parent_id, depth) AS (
        SELECT id, parent_id, 0 FROM storage_locations WHERE id = ?
        UNION ALL
        SELECT s.id, s.parent_id, a.depth + 1 FROM storage_locations s JOIN anc a ON s.id = a.parent_id
        WHERE a.depth < ${MAX_STORAGE_DEPTH}
      )
      SELECT 1 AS hit FROM anc WHERE id = ? LIMIT 1`).bind(newParentId, storageId).first()
    if (hit) throw invalid('하위 수납공간을 상위로 지정할 수 없습니다.', 'STORAGE_CYCLE')
  }

  app.get('/api/v1/rooms/:id/storage-locations', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedRoom(c.env.DB, id, c.get('userId')))
    const { results } = await c.env.DB.prepare('SELECT * FROM storage_locations WHERE room_id=? ORDER BY sort_order,id').bind(id).all<Row>()
    return c.json(ok(tree(results)))
  })
  app.post('/api/v1/rooms/:id/storage-locations', async (c) => {
    const roomId = pathId(c)
    await requireOwned(ownedRoom(c.env.DB, roomId, c.get('userId')))
    const b = await readBody(c)
    const name = text(b.name, '수납공간 이름', { required: true, max: 100 })!
    const description = text(b.description, '설명', { max: 500 })
    const parentId = optionalId(b.parentId, '상위 수납공간')
    const sortOrder = integer(b.sortOrder, '정렬 순서', 0)
    if (parentId) await assertParentInRoom(c.env.DB, parentId, roomId)
    const row = await c.env.DB.prepare('INSERT INTO storage_locations(room_id,parent_id,name,description,sort_order) VALUES(?,?,?,?,?) RETURNING *')
      .bind(roomId, parentId, name, description, sortOrder).first<Row>()
    return c.json(ok(await storageJson(c.env.DB, row!)), 201)
  })
  /**
   * 보관장소(방)를 다른 보관장소 안의 수납공간으로 옮긴다. 예: "냉장고" → "주방 > 냉장고".
   * 옮기는 보관장소의 수납공간과 물건이 모두 따라가고, 원래 보관장소는 없어진다.
   *   - 수납공간: 통째로 대상 보관장소로 옮기고, 맨 위 단계는 새로 생긴 수납공간 아래에 붙인다.
   *   - 물건: 대상 보관장소로 옮긴다. 수납공간이 없던 물건은 새 수납공간에 넣는다.
   */
  app.post('/api/v1/rooms/:id/move-into', async (c) => {
    const db = c.env.DB
    const userId = c.get('userId')
    const sourceId = pathId(c)
    const source = await requireOwned(ownedRoom(db, sourceId, userId))
    const b = await readBody(c)
    const targetId = optionalId(b.targetRoomId, '옮길 보관장소')
    if (!targetId) throw invalid('옮길 보관장소를 선택해 주세요.')
    if (targetId === sourceId) throw invalid('같은 보관장소 안으로는 옮길 수 없습니다.', 'ROOM_MOVE_INVALID')
    // 다른 사용자의 보관장소나 다른 집의 보관장소로는 옮길 수 없다.
    const target = await ownedRoom(db, targetId, userId)
    if (!target || target.home_id !== source.home_id) throw invalid('같은 집의 보관장소로만 옮길 수 있습니다.', 'ROOM_MOVE_INVALID')

    const created = await db
      .prepare('INSERT INTO storage_locations(room_id,parent_id,name,description,sort_order) VALUES(?,NULL,?,?,0) RETURNING *')
      .bind(targetId, source.name, source.description ?? null).first<Row>()
    const storageId = Number(created!.id)
    try {
      // 한 번의 batch(트랜잭션)로 옮긴다. 순서가 중요하다: 맨 위 단계를 먼저 새 수납공간 아래에 붙인 뒤 방을 바꾼다.
      await db.batch([
        db.prepare('UPDATE storage_locations SET parent_id=?, updated_at=CURRENT_TIMESTAMP WHERE room_id=? AND parent_id IS NULL').bind(storageId, sourceId),
        db.prepare('UPDATE storage_locations SET room_id=? WHERE room_id=?').bind(targetId, sourceId),
        db.prepare('UPDATE items SET room_id=?, storage_location_id=coalesce(storage_location_id, ?), updated_at=CURRENT_TIMESTAMP WHERE room_id=?').bind(targetId, storageId, sourceId),
        db.prepare('DELETE FROM rooms WHERE id=?').bind(sourceId),
      ])
    } catch (error) {
      // 옮기지 못했으면 먼저 만들어 둔 빈 수납공간을 지운다.
      await db.prepare('DELETE FROM storage_locations WHERE id=?').bind(storageId).run().catch(() => {})
      throw error
    }
    return c.json(ok(await storageJson(db, created!)))
  })

  app.get('/api/v1/storage-locations/:id', async (c) => {
    const row = await requireOwned(ownedStorage(c.env.DB, pathId(c), c.get('userId')))
    return c.json(ok(await storageJson(c.env.DB, row)))
  })
  app.put('/api/v1/storage-locations/:id', async (c) => {
    const id = pathId(c)
    const current = await requireOwned(ownedStorage(c.env.DB, id, c.get('userId')))
    const b = await readBody(c)
    const name = text(b.name, '수납공간 이름', { required: true, max: 100 })!
    const description = text(b.description, '설명', { max: 500 })
    const parentId = optionalId(b.parentId, '상위 수납공간')
    if (parentId) {
      await assertParentInRoom(c.env.DB, parentId, current.room_id)
      await assertNoCycle(c.env.DB, id, parentId)
    }
    const row = await c.env.DB.prepare('UPDATE storage_locations SET name=?,parent_id=?,description=coalesce(?,description),updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *')
      .bind(name, parentId, description, id).first<Row>()
    return c.json(ok(await storageJson(c.env.DB, row!)))
  })
  app.delete('/api/v1/storage-locations/:id', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedStorage(c.env.DB, id, c.get('userId')))
    await c.env.DB.prepare('DELETE FROM storage_locations WHERE id=?').bind(id).run()
    return c.json(ok())
  })
}
