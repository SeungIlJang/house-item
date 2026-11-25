import type { App, Row } from '../types.ts'
import { ApiError, invalid, ok } from '../lib/http.ts'
import { LIMITS } from '../lib/limits.ts'
import { parseLabelDate } from '../lib/labelDate.ts'

// 사진을 읽는 모델(Cloudflare Workers AI). 무료 한도는 하루 10,000 뉴런이고 UTC 자정에 초기화된다.
const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'
// 앱이 긴 변 1024px JPEG 로 줄여 보내므로 보통 200KB 안팎이다.
const MAX_BYTES = 2 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

const PROMPT = `You look at a photo of a household item (usually a Korean product) and report what is printed on it.
Reply with ONLY a JSON object, no other text:
{"name": string or null, "date_text": string or null, "date_kind": "expiry" | "manufacture" | "unknown"}

- name: a short name a person would use to find this item later. Prefer the product name printed on the package, in the language printed (Korean stays Korean), e.g. "서울우유 1L". If no name is printed but it is obvious what the item is, give a short generic Korean name, e.g. "우유". If you cannot tell, use null.
- date_text: the date printed or stamped on the item, copied character by character exactly as it appears (digits and separators, including any time next to it), e.g. "2026.11.23" or "11.23 10:03". Do not add a year that is not printed. If there are several dates, choose the expiry date. If no date is visible, use null.
- date_kind: "expiry" if words such as 유통기한, 소비기한, 까지, EXP, BEST BEFORE are visible next to the date; "manufacture" ONLY if words such as 제조, 제조일자, MFG are actually visible next to the date; if no such words are visible in the photo, use "unknown". Never infer the kind from the date format alone.`

const toBase64 = (bytes: Uint8Array) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** 모델 답에서 JSON 객체만 꺼낸다. 앞뒤에 설명이나 코드 블록 표시가 붙어 와도 읽는다. */
export function parseModelReply(reply: unknown): Row | null {
  if (reply && typeof reply === 'object') return reply as Row
  if (typeof reply !== 'string') return null
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(reply.slice(start, end + 1)) } catch { return null }
}

const cleanText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text && !/^(null|none|unknown|n\/a)$/i.test(text) ? text.slice(0, max) : null
}

export function registerVisionRoutes(app: App) {
  /**
   * 물건 사진에서 이름과 유통기한을 읽는다. 저장하지 않고 읽은 값만 돌려주며, 앱이 등록 화면의 빈 칸에 채운다.
   * form: file(사진), today(사용자의 오늘 날짜 'YYYY-MM-DD')
   */
  app.post('/api/v1/vision/label', async (c) => {
    let form: FormData
    try { form = await c.req.formData() } catch { throw new ApiError(400, 'INVALID_FILE', '이미지 파일이 필요합니다.') }
    const file = form.get('file')
    if (!(file instanceof File)) throw invalid('이미지 파일이 필요합니다.', 'INVALID_FILE')
    if (!TYPES.includes(file.type)) throw invalid('jpg, png, webp 이미지만 읽을 수 있습니다.', 'INVALID_FILE')
    if (file.size > MAX_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE', '읽을 사진은 2MB 이하여야 합니다.')
    const todayRaw = form.get('today')
    const today = typeof todayRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayRaw) ? todayRaw : new Date().toISOString().slice(0, 10)
    if (!c.env.AI) throw new ApiError(503, 'AI_UNAVAILABLE', '사진 읽기를 지금 사용할 수 없습니다.')

    // 하루 사용량(lib/limits.ts). 무료 한도를 넘지 않게 사용자별 · 전체 횟수를 함께 본다.
    const userId = c.get('userId')
    const used = await c.env.DB
      .prepare("SELECT coalesce(sum(count), 0) AS total, coalesce(sum(CASE WHEN user_id = ? THEN count END), 0) AS mine FROM ai_usage WHERE day = date('now')")
      .bind(userId).first<Row>()
    if (Number(used?.mine) >= LIMITS.labelReadsPerUserPerDay || Number(used?.total) >= LIMITS.labelReadsPerDay) {
      throw new ApiError(429, 'AI_RATE_LIMIT', '오늘 사진 읽기 횟수를 모두 썼습니다. 날짜와 이름을 직접 입력해 주세요.')
    }
    // 읽기에 실패해도 횟수는 센다(실패를 반복시켜 한도를 넘기는 것을 막는다). 지난 기록은 함께 지운다.
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO ai_usage(user_id, day, count) VALUES(?, date('now'), 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1").bind(userId),
      c.env.DB.prepare("DELETE FROM ai_usage WHERE day < date('now', '-7 day')"),
    ])

    let reply: unknown
    try {
      const image = `data:${file.type};base64,${toBase64(new Uint8Array(await file.arrayBuffer()))}`
      const result = await (c.env.AI as any).run(MODEL, {
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: image } }] }],
        max_tokens: 200,
        temperature: 0,
      })
      reply = result?.response ?? result
      // 사용량 확인용(observability 로그). 한도(lib/limits.ts)를 조정할 때 본다.
      console.log('vision/label usage', JSON.stringify(result?.usage ?? null))
    } catch (error) {
      console.error('vision/label failed', error)
      throw new ApiError(503, 'AI_UNAVAILABLE', '사진을 읽지 못했습니다.')
    }

    const parsed = parseModelReply(reply)
    const dateText = cleanText(parsed?.date_text, 40)
    const dateKind = ['expiry', 'manufacture'].includes(parsed?.date_kind) ? String(parsed!.date_kind) : 'unknown'
    const date = dateText ? parseLabelDate(dateText, today) : null
    return c.json(ok({
      name: cleanText(parsed?.name, 100),
      // 제조일로 표시된 날짜는 유통기한 칸에 넣지 않는다. 표시가 없는 날짜는 유통기한 후보로 돌려주고 앱이 확인을 받는다.
      expirationDate: dateKind === 'manufacture' ? null : date,
      dateText,
      dateKind,
    }))
  })
}
