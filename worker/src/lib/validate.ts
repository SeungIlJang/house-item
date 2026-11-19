import { invalid, notFoundError } from './http.ts'

/** 문자열 필드. 앞뒤 공백을 지우고, 빈 문자열은 null 로 본다. */
export const text = (value: unknown, label: string, opts: { required?: boolean; max: number }) => {
  if (value === undefined || value === null) {
    if (opts.required) throw invalid(`${label}을(를) 입력해주세요.`)
    return null
  }
  if (typeof value !== 'string') throw invalid(`${label} 형식이 올바르지 않습니다.`)
  const trimmed = value.trim()
  if (opts.required && !trimmed) throw invalid(`${label}을(를) 입력해주세요.`)
  if (trimmed.length > opts.max) throw invalid(`${label}은(는) ${opts.max}자 이하여야 합니다.`)
  return trimmed || null
}

export const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0

/** 선택 ID 필드. null/undefined 는 null, 그 외에는 양의 정수여야 한다. */
export const optionalId = (value: unknown, label: string) => {
  if (value === undefined || value === null) return null
  if (!isId(value)) throw invalid(`${label} 값이 올바르지 않습니다.`)
  return value
}

export const integer = (value: unknown, label: string, fallback: number, min = Number.MIN_SAFE_INTEGER) => {
  if (value === undefined || value === null) return fallback
  if (!Number.isSafeInteger(value) || (value as number) < min) throw invalid(`${label} 값이 올바르지 않습니다.`)
  return value as number
}

export const dateField = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid(`${label} 형식이 올바르지 않습니다.`)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw invalid(`${label} 형식이 올바르지 않습니다.`)
  return value
}

/** 경로의 :id. 숫자가 아니면 존재하지 않는 대상으로 취급한다. */
export const pathId = (c: any, name = 'id') => {
  const raw = c.req.param(name)
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN
  if (!isId(value)) throw notFoundError()
  return value
}

/** 쿼리스트링 ID. 비어 있으면 null. */
export const queryId = (raw: string | undefined, label: string) => {
  if (raw === undefined || raw === '') return null
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN
  if (!isId(value)) throw invalid(`${label} 값이 올바르지 않습니다.`)
  return value
}

export const queryInt = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const value = raw && /^\d+$/.test(raw) ? Number(raw) : fallback
  return Math.min(max, Math.max(min, value))
}
