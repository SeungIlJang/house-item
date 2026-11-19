import type { Row } from '../types.ts'

// ──────────────────────────────────────────────────────────────
// 수납공간 (계층)
// ──────────────────────────────────────────────────────────────

// 깊이 제한은 혹시 남아 있을 수 있는 순환 데이터에서 재귀가 끝나도록 하는 안전장치다.
export const MAX_STORAGE_DEPTH = 64

/** 여러 수납공간의 전체 경로("붙박이장 > 두 번째 서랍")를 쿼리 한 번으로 계산한다. */
export const storagePathsStatement = (db: D1Database, ids: number[]) => db.prepare(`
  WITH RECURSIVE anc(start_id, id, parent_id, name, depth) AS (
    SELECT id, id, parent_id, name, 0 FROM storage_locations WHERE id IN (SELECT value FROM json_each(?))
    UNION ALL
    SELECT a.start_id, s.id, s.parent_id, s.name, a.depth + 1
    FROM storage_locations s JOIN anc a ON s.id = a.parent_id
    WHERE a.depth < ${MAX_STORAGE_DEPTH}
  )
  SELECT start_id, name FROM anc ORDER BY start_id, depth DESC`).bind(JSON.stringify(ids))

export const toPathMap = (rows: Row[]) => {
  const names = new Map<number, string[]>()
  for (const row of rows) {
    const list = names.get(row.start_id) ?? []
    list.push(row.name)
    names.set(row.start_id, list)
  }
  return new Map([...names].map(([id, list]) => [id, list.join(' > ')]))
}

export const storageJson = async (db: D1Database, row: Row) => {
  const { results } = await storagePathsStatement(db, [row.id]).all<Row>()
  return {
    id: row.id, roomId: row.room_id, parentId: row.parent_id ?? null, name: row.name,
    description: row.description ?? null, sortOrder: row.sort_order,
    fullPath: toPathMap(results).get(row.id) ?? row.name,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
