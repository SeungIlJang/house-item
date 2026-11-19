import type { Row } from '../types.ts'

export const userJson = (row: Row) => ({ id: row.id, email: row.email ?? null, name: row.name, avatarUrl: row.avatar_url ?? null, createdAt: row.created_at })
export const entityJson = (row: Row) => ({ id: row.id, name: row.name, description: row.description ?? null, createdAt: row.created_at, updatedAt: row.updated_at })
