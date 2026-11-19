// 유통기한 날짜 계산과 알림 예약 계획 검증. 모든 시각은 기기 현지 시간이다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/expiry.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const {
  daysUntil, expiryLabel, expiryTone, toLocalDateString, addDays, planReminders, REMINDER_ID_BASE, MAX_REMINDERS,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const local = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

test('남은 일수와 표시', () => {
  const now = local(2026, 11, 19, 23, 30) // 밤늦게라도 날짜 기준으로 센다
  assert.equal(daysUntil('2026-11-19', now), 0)
  assert.equal(daysUntil('2026-11-20', now), 1)
  assert.equal(daysUntil('2026-11-12', now), -7)
  assert.equal(daysUntil('2027-01-01', now), 43) // 월·연 경계
  assert.equal(expiryLabel(-2), '2일 지남')
  assert.equal(expiryLabel(0), '오늘 만료')
  assert.equal(expiryLabel(5), 'D-5')
  assert.deepEqual([expiryTone(-1), expiryTone(0), expiryTone(7), expiryTone(8)], ['danger', 'danger', 'warning', 'medium'])
  assert.equal(toLocalDateString(addDays(local(2026, 12, 30), 3)), '2027-01-02')
})

test('알림 계획: 기본은 만료 N일 전 9시', () => {
  const now = local(2026, 11, 19, 10)
  const [plan] = planReminders([{ id: 7, name: '우유', expirationDate: '2026-11-30' }], 3, 9, now)
  assert.equal(plan.id, REMINDER_ID_BASE + 7)
  assert.equal(plan.itemId, 7)
  assert.equal(plan.at.getTime(), local(2026, 11, 27, 9).getTime())
  assert.equal(plan.title, '우유')
  assert.equal(plan.body, '유통기한이 3일 남았어요 (2026-11-30)')
})

test('알림 계획: 늦게 등록하면 다음 9시, 만료일 9시가 지나면 생략', () => {
  const morning = local(2026, 11, 19, 7)
  const evening = local(2026, 11, 19, 21)
  const items = [
    { id: 1, name: '내일 만료', expirationDate: '2026-11-20' },
    { id: 2, name: '오늘 만료', expirationDate: '2026-11-19' },
    { id: 3, name: '지난 것', expirationDate: '2026-11-10' },
    { id: 4, name: '', expirationDate: '2026-11-21' },
    { id: 5, name: '기한 없음', expirationDate: null },
  ]

  // 아침 7시: 오늘 9시에 오늘 만료·내일 만료·모레 만료를 알린다
  const am = planReminders(items, 3, 9, morning)
  assert.deepEqual(am.map((p) => p.itemId), [1, 2, 4])
  assert.ok(am.every((p) => p.at.getTime() === local(2026, 11, 19, 9).getTime()))
  assert.equal(am.find((p) => p.itemId === 2).body, '오늘이 유통기한이에요 (2026-11-19)')
  assert.equal(am.find((p) => p.itemId === 4).title, '이름 없는 물건')

  // 밤 9시: 오늘 만료는 이미 늦어 생략, 나머지는 내일 9시
  const pm = planReminders(items, 3, 9, evening)
  assert.deepEqual(pm.map((p) => p.itemId).sort(), [1, 4])
  assert.ok(pm.every((p) => p.at.getTime() === local(2026, 11, 20, 9).getTime()))
  assert.equal(pm.find((p) => p.itemId === 1).body, '오늘이 유통기한이에요 (2026-11-20)')
})

test('알림 계획: 가까운 순으로 최대 개수까지만', () => {
  const now = local(2026, 11, 19, 10)
  const items = Array.from({ length: MAX_REMINDERS + 10 }, (_, i) => ({
    id: i + 1, name: `물건${i}`, expirationDate: toLocalDateString(addDays(now, 60 - i)),
  }))
  const plans = planReminders(items, 1, 9, now)
  assert.equal(plans.length, MAX_REMINDERS)
  for (let i = 1; i < plans.length; i++) assert.ok(plans[i - 1].at <= plans[i].at)
  // 가장 빨리 만료되는 50개(id 11~60)가 들어가고, 먼 10개(id 1~10)는 빠진다
  assert.deepEqual(plans.map((p) => p.itemId).sort((a, b) => a - b), Array.from({ length: MAX_REMINDERS }, (_, i) => i + 11))
})
