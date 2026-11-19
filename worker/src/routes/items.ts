import type { App, Row } from '../types.ts'
import { ok, readBody, invalid, ApiError } from '../lib/http.ts'
import { text, isId, optionalId, integer, dateField, pathId, queryId, queryInt } from '../lib/validate.ts'
import { entityJson } from '../lib/json.ts'
import { ownedHome, ownedRoom, ownedStorage, requireOwned } from '../lib/owned.ts'
import { deleteObjects, imageKeys } from '../lib/cleanup.ts'
import { storagePathsStatement, toPathMap } from '../lib/storagePaths.ts'

export function registerItemRoutes(app: App) {
  // ──────────────────────────────────────────────────────────────
  // 물건
  // ──────────────────────────────────────────────────────────────

  const MAX_TAGS_PER_ITEM = 30
  const itemBase = 'SELECT i.*,c.name category_name,r.name room_name FROM items i LEFT JOIN categories c ON c.id=i.category_id LEFT JOIN rooms r ON r.id=i.room_id'
  const ownedItem = (db: D1Database, id: number, userId: number) => db.prepare(`${itemBase} WHERE i.id=? AND i.user_id=?`).bind(id, userId).first<Row>()

  const imageJson = (i: Row) => ({ id: i.id, imageUrl: i.image_url, originalFilename: i.original_filename, sortOrder: i.sort_order, createdAt: i.created_at })

  /**
   * 물건 여러 개를 응답 형태로 바꾼다.
   * 태그·이미지·수납 경로를 물건마다 따로 조회하면 목록 20개에 쿼리가 80번 안팎 나가
   * D1 무료 플랜의 요청당 쿼리 한도를 넘는다. 그래서 종류별로 한 번씩, 한 번의 batch 로 가져온다.
   */
  const itemsJson = async (db: D1Database, rows: Row[]) => {
    if (!rows.length) return []
    const itemIds = JSON.stringify(rows.map((r) => r.id))
    const storageIds = [...new Set(rows.map((r) => r.storage_location_id).filter(isId))]
    const statements = [
      db.prepare('SELECT it.item_id, t.* FROM item_tags it JOIN tags t ON t.id=it.tag_id WHERE it.item_id IN (SELECT value FROM json_each(?)) ORDER BY t.name').bind(itemIds),
      db.prepare('SELECT * FROM item_images WHERE item_id IN (SELECT value FROM json_each(?)) ORDER BY sort_order,id').bind(itemIds),
    ]
    if (storageIds.length) statements.push(storagePathsStatement(db, storageIds))
    const [tagResult, imageResult, pathResult] = await db.batch<Row>(statements)

    const group = (list: Row[]) => {
      const map = new Map<number, Row[]>()
      for (const row of list) map.set(row.item_id, [...(map.get(row.item_id) ?? []), row])
      return map
    }
    const tagsByItem = group(tagResult.results)
    const imagesByItem = group(imageResult.results)
    const paths = toPathMap(pathResult?.results ?? [])

    return rows.map((row) => {
      const images = (imagesByItem.get(row.id) ?? []).map(imageJson)
      return {
        id: row.id, name: row.name, description: row.description ?? null, quantity: row.quantity, memo: row.memo ?? null,
        purchaseDate: row.purchase_date ?? null, expirationDate: row.expiration_date ?? null,
        homeId: row.home_id, roomId: row.room_id ?? null, storageLocationId: row.storage_location_id ?? null,
        categoryId: row.category_id ?? null, categoryName: row.category_name ?? null, roomName: row.room_name ?? null,
        storageFullPath: row.storage_location_id ? paths.get(row.storage_location_id) ?? null : null,
        tags: (tagsByItem.get(row.id) ?? []).map(entityJson),
        images, thumbnailUrl: images[0]?.imageUrl ?? null,
        createdAt: row.created_at, updatedAt: row.updated_at,
      }
    })
  }
  const itemJson = async (db: D1Database, row: Row) => (await itemsJson(db, [row]))[0]

  /**
   * 물건 입력을 검증한다. 연결하는 집·방·수납공간·카테고리·태그는 모두 본인 것이어야 하고
   * 방은 그 집에, 수납공간은 그 방에 속해야 한다. 검사하지 않으면 남의 ID 를 넣어
   * 응답으로 그 사람의 방·수납공간·카테고리·태그 이름을 받아볼 수 있다.
   */
  const itemInput = async (db: D1Database, userId: number, b: Row) => {
    const input = {
      name: text(b.name, '이름', { max: 200 }) ?? '',
      description: text(b.description, '설명', { max: 2000 }),
      memo: text(b.memo, '메모', { max: 2000 }),
      quantity: integer(b.quantity, '수량', 1, 0),
      purchaseDate: dateField(b.purchaseDate, '구매일'),
      expirationDate: dateField(b.expirationDate, '유효기간'),
      homeId: optionalId(b.homeId, '집'),
      roomId: optionalId(b.roomId, '방'),
      storageLocationId: optionalId(b.storageLocationId, '수납공간'),
      categoryId: optionalId(b.categoryId, '카테고리'),
      tagIds: [] as number[],
    }
    if (b.tagIds !== undefined && b.tagIds !== null) {
      if (!Array.isArray(b.tagIds) || !b.tagIds.every(isId)) throw invalid('태그 값이 올바르지 않습니다.')
      input.tagIds = [...new Set(b.tagIds as number[])]
      if (input.tagIds.length > MAX_TAGS_PER_ITEM) throw invalid(`태그는 ${MAX_TAGS_PER_ITEM}개까지 지정할 수 있습니다.`)
    }
    if (input.purchaseDate && input.expirationDate && input.expirationDate < input.purchaseDate) {
      throw invalid('유효기간은 구매일보다 빠를 수 없습니다.')
    }
    if (!input.homeId || !await ownedHome(db, input.homeId, userId)) throw invalid('집을 찾을 수 없습니다.', 'INVALID_HOME')

    if (input.roomId) {
      const room = await ownedRoom(db, input.roomId, userId)
      if (!room || room.home_id !== input.homeId) throw invalid('방이 선택한 집에 속하지 않습니다.', 'ROOM_HOME_MISMATCH')
    }
    if (input.storageLocationId) {
      if (!input.roomId) throw invalid('수납공간을 지정하려면 방을 먼저 선택해야 합니다.', 'STORAGE_WITHOUT_ROOM')
      const storage = await ownedStorage(db, input.storageLocationId, userId)
      if (!storage || storage.room_id !== input.roomId) throw invalid('수납공간이 선택한 방에 속하지 않습니다.', 'STORAGE_ROOM_MISMATCH')
    }
    if (input.categoryId) {
      const category = await db.prepare('SELECT id FROM categories WHERE id=? AND user_id=?').bind(input.categoryId, userId).first()
      if (!category) throw invalid('카테고리를 찾을 수 없습니다.', 'CATEGORY_NOT_FOUND')
    }
    if (input.tagIds.length) {
      const found = await db.prepare('SELECT count(*) AS n FROM tags WHERE user_id=? AND id IN (SELECT value FROM json_each(?))')
        .bind(userId, JSON.stringify(input.tagIds)).first<Row>()
      if (Number(found?.n) !== input.tagIds.length) throw invalid('존재하지 않는 태그가 포함되어 있습니다.', 'TAG_NOT_FOUND')
    }
    return input
  }

  const tagStatements = (db: D1Database, itemId: number, tagIds: number[]) => [
    db.prepare('DELETE FROM item_tags WHERE item_id=?').bind(itemId),
    ...tagIds.map((tagId) => db.prepare('INSERT OR IGNORE INTO item_tags(item_id,tag_id) VALUES(?,?)').bind(itemId, tagId)),
  ]

  const listItems = async (c: any) => {
    const q = c.req.query()
    const where = ['i.user_id=?']
    const vals: unknown[] = [c.get('userId')]
    const filters = [['home_id', 'i.home_id', '집'], ['room_id', 'i.room_id', '방'], ['storage_location_id', 'i.storage_location_id', '수납공간'], ['category_id', 'i.category_id', '카테고리']] as const
    for (const [key, col, label] of filters) {
      const id = queryId(q[key], label)
      if (id) { where.push(`${col}=?`); vals.push(id) }
    }
    const keyword = typeof q.keyword === 'string' ? q.keyword.trim().slice(0, 100) : ''
    if (keyword) {
      where.push('(i.name LIKE ? OR i.description LIKE ? OR i.memo LIKE ?)')
      vals.push(...Array(3).fill(`%${keyword}%`))
    }
    const tagId = queryId(q.tag_id, '태그')
    if (tagId) {
      where.push('EXISTS(SELECT 1 FROM item_tags it WHERE it.item_id=i.id AND it.tag_id=?)')
      vals.push(tagId)
    }
    // 유통기한 임박: 이 날짜(포함) 이전에 만료되는 물건. 이미 지난 것도 포함한다.
    // 서버는 UTC 라 "오늘"이 사용자와 다를 수 있으므로 기준일은 앱이 현지 날짜로 계산해 보낸다.
    const expiresBefore = q.expires_before ? dateField(q.expires_before, '만료 기준일') : null
    if (expiresBefore) {
      where.push('i.expiration_date IS NOT NULL AND i.expiration_date <= ?')
      vals.push(expiresBefore)
    }
    const page = queryInt(q.page, 1, 1, 100000)
    const size = queryInt(q.size, 20, 1, 100)
    const orders: Record<string, string> = {
      name: 'i.name, i.id',
      expiration: 'i.expiration_date IS NULL, i.expiration_date, i.id',
    }
    const order = orders[q.sort] ?? 'i.created_at DESC, i.id DESC'
    const db: D1Database = c.env.DB
    const [countResult, pageResult] = await db.batch<Row>([
      db.prepare(`SELECT count(*) AS total FROM items i WHERE ${where.join(' AND ')}`).bind(...vals),
      db.prepare(`${itemBase} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...vals, size, (page - 1) * size),
    ])
    const total = Number(countResult.results[0]?.total ?? 0)
    return c.json(ok({ content: await itemsJson(db, pageResult.results), page, size, totalElements: total, totalPages: Math.ceil(total / size) }))
  }

  app.get('/api/v1/items', listItems)
  app.get('/api/v1/items/search', listItems)
  app.get('/api/v1/items/:id', async (c) => {
    const row = await requireOwned(ownedItem(c.env.DB, pathId(c), c.get('userId')))
    return c.json(ok(await itemJson(c.env.DB, row)))
  })
  app.post('/api/v1/items', async (c) => {
    const db = c.env.DB
    const userId = c.get('userId')
    const input = await itemInput(db, userId, await readBody(c))
    const created = await db.prepare('INSERT INTO items(user_id,home_id,room_id,storage_location_id,category_id,name,description,quantity,memo,purchase_date,expiration_date) VALUES(?,?,?,?,?,?,?,?,?,?,?) RETURNING id')
      .bind(userId, input.homeId, input.roomId, input.storageLocationId, input.categoryId, input.name, input.description, input.quantity, input.memo, input.purchaseDate, input.expirationDate).first<Row>()
    const id = Number(created!.id)
    if (input.tagIds.length) await db.batch(tagStatements(db, id, input.tagIds))
    return c.json(ok(await itemJson(db, (await ownedItem(db, id, userId))!)), 201)
  })
  app.put('/api/v1/items/:id', async (c) => {
    const db = c.env.DB
    const userId = c.get('userId')
    const id = pathId(c)
    await requireOwned(ownedItem(db, id, userId))
    const input = await itemInput(db, userId, await readBody(c))
    await db.batch([
      db.prepare('UPDATE items SET home_id=?,room_id=?,storage_location_id=?,category_id=?,name=?,description=?,quantity=?,memo=?,purchase_date=?,expiration_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(input.homeId, input.roomId, input.storageLocationId, input.categoryId, input.name, input.description, input.quantity, input.memo, input.purchaseDate, input.expirationDate, id),
      ...tagStatements(db, id, input.tagIds),
    ])
    return c.json(ok(await itemJson(db, (await ownedItem(db, id, userId))!)))
  })
  app.delete('/api/v1/items/:id', async (c) => {
    const id = pathId(c)
    await requireOwned(ownedItem(c.env.DB, id, c.get('userId')))
    const keys = await imageKeys(c.env.DB, 'i.id=?', id)
    await c.env.DB.prepare('DELETE FROM items WHERE id=?').bind(id).run()
    await deleteObjects(c.env.IMAGES, keys)
    return c.json(ok())
  })

  // ──────────────────────────────────────────────────────────────
  // 이미지
  // ──────────────────────────────────────────────────────────────

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024
  const IMAGE_TYPES: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  }

  app.post('/api/v1/items/:id/images', async (c) => {
    const itemId = pathId(c)
    await requireOwned(ownedItem(c.env.DB, itemId, c.get('userId')))
    let form: FormData
    try { form = await c.req.formData() } catch { throw new ApiError(400, 'INVALID_FILE', '이미지 파일이 필요합니다.') }
    const file = form.get('file')
    if (!(file instanceof File)) throw invalid('이미지 파일이 필요합니다.', 'INVALID_FILE')
    if (file.size > MAX_IMAGE_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE', '이미지는 10MB 이하여야 합니다.')

    // 확장자와 MIME 이 모두 이미지일 때만 받는다. MIME 없이 온 파일은 multipart 에서
    // application/octet-stream 이 되므로, 그때는 확장자로 MIME 을 정한다.
    const ext = (file.name.includes('.') ? file.name.split('.').pop()! : '').toLowerCase()
    const contentType = file.type && file.type !== 'application/octet-stream' ? file.type : IMAGE_TYPES[ext]
    if (!IMAGE_TYPES[ext] || !contentType?.startsWith('image/')) {
      throw invalid('jpg, png, webp, gif, heic 이미지만 올릴 수 있습니다.', 'INVALID_FILE')
    }

    const key = `items/${c.get('userId')}/${itemId}/${crypto.randomUUID()}.${ext}`
    await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType } })
    const url = `${c.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`
    const originalName = file.name.slice(0, 255)
    const row = await c.env.DB.prepare('INSERT INTO item_images(item_id,object_key,image_url,original_filename) VALUES(?,?,?,?) RETURNING *')
      .bind(itemId, key, url, originalName).first<Row>()
    return c.json(ok(imageJson(row!)), 201)
  })
  app.delete('/api/v1/items/:itemId/images/:imageId', async (c) => {
    const itemId = pathId(c, 'itemId')
    await requireOwned(ownedItem(c.env.DB, itemId, c.get('userId')))
    const row = await requireOwned(c.env.DB.prepare('SELECT * FROM item_images WHERE id=? AND item_id=?').bind(pathId(c, 'imageId'), itemId).first<Row>())
    await c.env.DB.prepare('DELETE FROM item_images WHERE id=?').bind(row.id).run()
    await deleteObjects(c.env.IMAGES, [String(row.object_key)])
    return c.json(ok())
  })
}
