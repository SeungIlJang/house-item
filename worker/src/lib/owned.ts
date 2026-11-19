import type { Row } from '../types.ts'
import { notFoundError } from './http.ts'

// ──────────────────────────────────────────────────────────────
// 소유권
// ──────────────────────────────────────────────────────────────

export const ownedHome = (db: D1Database, id: number, userId: number) => db.prepare('SELECT * FROM homes WHERE id=? AND user_id=?').bind(id, userId).first<Row>()
export const ownedRoom = (db: D1Database, id: number, userId: number) => db.prepare('SELECT r.* FROM rooms r JOIN homes h ON h.id=r.home_id WHERE r.id=? AND h.user_id=?').bind(id, userId).first<Row>()
export const ownedStorage = (db: D1Database, id: number, userId: number) => db.prepare('SELECT s.* FROM storage_locations s JOIN rooms r ON r.id=s.room_id JOIN homes h ON h.id=r.home_id WHERE s.id=? AND h.user_id=?').bind(id, userId).first<Row>()

export const requireOwned = async <T>(lookup: Promise<T | null>) => {
  const row = await lookup
  if (!row) throw notFoundError()
  return row
}
