// 테스트용 Worker 환경.
//
// D1 은 node:sqlite 위에 흉내 낸다. 실제 마이그레이션을 적용하므로 스키마·CASCADE·재귀 쿼리·json_each 가
// 운영과 같은 SQLite 엔진으로 검증된다. 요청마다 실행한 쿼리 수도 센다(D1 무료 플랜은 요청당 50회 제한).
// R2 는 Map 으로 흉내 낸다.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import app from '../../src/index.ts'
import { makeToken } from '../../src/lib/jwt.ts'

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations')
export const SECRET = 'test-only-secret'

const plain = (row) => (row ? { ...row } : row)

function createD1() {
  const db = new DatabaseSync(':memory:')
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
  db.exec('PRAGMA foreign_keys = ON') // D1 은 외래키를 항상 강제한다.
  const counter = { queries: 0 }

  class Statement {
    constructor(sql, params = []) { this.sql = sql; this.params = params }
    bind(...params) { return new Statement(this.sql, params) }
    exec() { counter.queries++; return db.prepare(this.sql) }
    async first(column) {
      const row = plain(this.exec().get(...this.params))
      if (!row) return null
      return column ? row[column] : row
    }
    async all() {
      return { success: true, results: this.exec().all(...this.params).map(plain), meta: {} }
    }
    async run() {
      const stmt = this.exec()
      if (/\bRETURNING\b/i.test(this.sql)) {
        return { success: true, results: stmt.all(...this.params).map(plain), meta: {} }
      }
      const info = stmt.run(...this.params)
      return { success: true, results: [], meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } }
    }
  }

  return {
    raw: db,
    counter,
    prepare: (sql) => new Statement(sql),
    // D1 batch 는 하나의 트랜잭션으로 실행된다.
    async batch(statements) {
      db.exec('BEGIN')
      try {
        const results = []
        for (const s of statements) results.push(await s.all())
        db.exec('COMMIT')
        return results
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}

function createR2() {
  const objects = new Map()
  return {
    objects,
    async put(key, body, options) {
      const bytes = body instanceof ReadableStream ? new Uint8Array(await new Response(body).arrayBuffer()) : body
      objects.set(key, { bytes, httpMetadata: options?.httpMetadata ?? {} })
    },
    async get(key) { return objects.get(key) ?? null },
    async delete(keys) { for (const key of [].concat(keys)) objects.delete(key) },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit)
      return { objects: keys.map((key) => ({ key })), truncated: false }
    },
  }
}

export function setup(overrides = {}) {
  const DB = createD1()
  const IMAGES = createR2()
  const env = {
    DB, IMAGES,
    JWT_SECRET_KEY: SECRET,
    APP_ENV: 'test',
    CORS_ORIGINS: 'https://localhost',
    APP_REDIRECT_URI: 'com.homeitems.app://auth',
    R2_PUBLIC_BASE_URL: 'https://images.example',
    ...overrides,
  }
  const pending = []
  const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} }

  /** 사용자를 만들고 그 사용자로 요청하는 함수를 돌려준다. */
  async function user(name = '사용자') {
    const { lastInsertRowid } = DB.raw.prepare('INSERT INTO users(name) VALUES(?)').run(name)
    const id = Number(lastInsertRowid)
    const token = await makeToken(id, SECRET)
    const call = async (method, path, body, { form, raw } = {}) => {
      const headers = { Authorization: `Bearer ${token}` }
      let payload = form ?? raw
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
      DB.counter.queries = 0
      const res = await app.request(`https://api.example/api/v1${path}`, { method, headers, body: payload }, env, ctx)
      const queries = DB.counter.queries
      await Promise.all(pending.splice(0))
      const json = await res.json().catch(() => null)
      return { status: res.status, json, data: json?.data, code: json?.errorCode, queries }
    }
    return { id, token, call }
  }

  return { env, DB, IMAGES, user }
}

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
export function imageForm(name = 'photo.png', type = 'image/png', bytes = PNG) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type }), name)
  return form
}
