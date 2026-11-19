import type { Row } from '../types.ts'

export const ok = (data: unknown = null, message: string | null = null) => ({ success: true, data, message })
export const fail = (message: string, errorCode: string) => ({ success: false, data: null, message, errorCode })

// ──────────────────────────────────────────────────────────────
// 입력 검증
//
// 잘못된 입력은 ApiError 를 던지고 onError 가 공통 응답으로 바꾼다.
// 이전에는 name 누락·잘못된 JSON 이 D1 제약 위반으로 500 이 됐다.
// ──────────────────────────────────────────────────────────────

// 테스트가 node --experimental-strip-types 로 실행되므로 생성자 매개변수 속성 문법은 쓰지 않는다.
export class ApiError extends Error {
  status: 400 | 404 | 409 | 413 | 422 | 429
  code: string
  constructor(status: 400 | 404 | 409 | 413 | 422 | 429, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
export const invalid = (message: string, code = 'VALIDATION_ERROR') => new ApiError(422, code, message)
export const notFoundError = () => new ApiError(404, 'NOT_FOUND', '대상을 찾을 수 없습니다.')

export const readBody = async (c: any): Promise<Row> => {
  let body: unknown
  try { body = await c.req.json() } catch { body = null }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_JSON', '요청 본문이 올바르지 않습니다.')
  }
  return body as Row
}
