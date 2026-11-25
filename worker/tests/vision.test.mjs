// 사진에서 이름·유통기한 읽기. AI 는 흉내 내고, 날짜 해석과 사용량 제한을 검증한다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { setup, imageForm } from './helpers/env.mjs'
import { LIMITS } from '../src/lib/limits.ts'
import { parseLabelDate } from '../src/lib/labelDate.ts'

test('날짜 해석: 포장에 찍힌 여러 표기를 날짜로 바꾼다', () => {
  const today = '2026-11-25'
  const cases = {
    '2026.11.23': '2026-11-23',
    '2027-03-05 까지': '2027-03-05',
    '2027년 3월 5일': '2027-03-05',
    '20270305': '2027-03-05',
    '27.03.05': '2027-03-05',
    '270305': '2027-03-05',
    '2027.03': '2027-03-31', // 월까지만 있으면 그 달 마지막 날
    '11.23 10:03 D': '2026-11-23', // 연도 없음 + 시각: 이틀 지난 날짜는 올해
    '12월 31일': '2026-12-31',
    '01.05': '2027-01-05', // 올해 1월 5일은 반년 넘게 지났으므로 내년
    '10:03': null, // 시각만 있으면 날짜가 아니다
    '13.45': null,
    '2026.02.30': null,
    '1999.01.01': null, // 터무니없는 연도
    'LOT A123': null,
  }
  for (const [text, expected] of Object.entries(cases)) assert.equal(parseLabelDate(text, today), expected, text)
  assert.equal(parseLabelDate('02.29', '2027-12-01'), null) // 2027년에는 2월 29일이 없다
})

const photo = (today = '2026-11-25') => {
  const form = imageForm('label.jpg', 'image/jpeg')
  form.append('today', today)
  return form
}
/** 정해진 답을 돌려주는 AI. 호출 내용을 calls 에 남긴다. */
const fakeAI = (reply) => {
  const calls = []
  return { calls, run: async (model, input) => { calls.push({ model, input }); if (reply instanceof Error) throw reply; return { response: reply } } }
}

test('사진 읽기: 이름과 날짜를 돌려주고, 제조일은 유통기한으로 넣지 않는다', async () => {
  const AI = fakeAI('```json\n{"name": "서울우유 1L", "date_text": "11.23 10:03", "date_kind": "unknown"}\n```')
  const { user } = setup({ AI })
  const { call } = await user()
  const read = await call('POST', '/vision/label', undefined, { form: photo() })
  assert.equal(read.status, 200)
  assert.deepEqual(read.data, { name: '서울우유 1L', expirationDate: '2026-11-23', dateText: '11.23 10:03', dateKind: 'unknown' })
  assert.ok(read.queries <= 4)
  // 사진은 data URL 로 모델에 전달된다
  const content = AI.calls[0].input.messages[0].content
  assert.ok(content.find((p) => p.type === 'image_url').image_url.url.startsWith('data:image/jpeg;base64,'))

  AI.run = async () => ({ response: '{"name": null, "date_text": "2026.11.01", "date_kind": "manufacture"}' })
  const made = (await call('POST', '/vision/label', undefined, { form: photo() })).data
  assert.deepEqual(made, { name: null, expirationDate: null, dateText: '2026.11.01', dateKind: 'manufacture' })

  // 모델이 엉뚱한 답을 해도 오류가 아니라 빈 결과
  AI.run = async () => ({ response: '죄송합니다. 읽을 수 없습니다.' })
  const none = await call('POST', '/vision/label', undefined, { form: photo() })
  assert.equal(none.status, 200)
  assert.deepEqual(none.data, { name: null, expirationDate: null, dateText: null, dateKind: 'unknown' })
})

test('사진 읽기: 잘못된 파일, AI 미설정·실패, 인증 없음', async () => {
  const { user, env } = setup({ AI: fakeAI(new Error('boom')) })
  const { call } = await user()
  assert.equal((await call('POST', '/vision/label', undefined, { form: imageForm('a.txt', 'text/plain') })).code, 'INVALID_FILE')
  assert.equal((await call('POST', '/vision/label', {})).code, 'INVALID_FILE')
  const failed = await call('POST', '/vision/label', undefined, { form: photo() })
  assert.equal(failed.status, 503)
  assert.equal(failed.code, 'AI_UNAVAILABLE')

  delete env.AI
  assert.equal((await call('POST', '/vision/label', undefined, { form: photo() })).code, 'AI_UNAVAILABLE')
})

test('사진 읽기: 사용자별 · 전체 하루 한도를 넘으면 429', async () => {
  const AI = fakeAI('{"name": "우유", "date_text": null, "date_kind": "unknown"}')
  const { user, DB } = setup({ AI })
  const a = await user('가')
  const b = await user('나')
  assert.equal((await a.call('POST', '/vision/label', undefined, { form: photo() })).status, 200)
  assert.equal(DB.raw.prepare('SELECT count FROM ai_usage WHERE user_id = ?').get(a.id).count, 1)

  // 가: 사용자 한도까지 채움 → 가는 막히고 나는 된다
  DB.raw.prepare('UPDATE ai_usage SET count = ? WHERE user_id = ?').run(LIMITS.labelReadsPerUserPerDay, a.id)
  const blocked = await a.call('POST', '/vision/label', undefined, { form: photo() })
  assert.equal(blocked.status, 429)
  assert.equal(blocked.code, 'AI_RATE_LIMIT')
  assert.equal((await b.call('POST', '/vision/label', undefined, { form: photo() })).status, 200)

  // 전체 한도를 채우면 모두 막힌다. 막힌 요청은 AI 를 부르지 않는다.
  DB.raw.prepare('UPDATE ai_usage SET count = ? WHERE user_id = ?').run(LIMITS.labelReadsPerDay, a.id)
  const before = AI.calls.length
  assert.equal((await b.call('POST', '/vision/label', undefined, { form: photo() })).code, 'AI_RATE_LIMIT')
  assert.equal(AI.calls.length, before)

  // 어제 기록은 오늘 한도에 들어가지 않는다
  DB.raw.prepare("UPDATE ai_usage SET day = date('now', '-1 day')").run()
  assert.equal((await a.call('POST', '/vision/label', undefined, { form: photo() })).status, 200)
})
