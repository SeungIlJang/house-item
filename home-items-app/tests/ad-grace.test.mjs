// 신규 사용자 광고 유예 판정 검증.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/adGrace.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { inAdGracePeriod, parseServerTime, AD_GRACE_DAYS, AD_GRACE_ITEMS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const HOUR = 60 * 60 * 1000
const JOINED = '2026-11-19 05:44:50' // 서버가 주는 형식(UTC, 시간대 표기 없음)
const joinedAt = Date.UTC(2026, 10, 19, 5, 44, 50)

test('서버 시각은 UTC 로 읽는다', () => {
  assert.equal(parseServerTime(JOINED), joinedAt)
  assert.equal(parseServerTime('2026-11-19T05:44:50Z'), joinedAt)
  assert.equal(parseServerTime('엉뚱한 값'), null)
  assert.equal(parseServerTime(null), null)
})

test('가입 3일 미만이고 물건 10개 미만이면 광고를 숨긴다', () => {
  assert.equal(AD_GRACE_DAYS, 3)
  assert.equal(AD_GRACE_ITEMS, 10)
  assert.equal(inAdGracePeriod(JOINED, 0, joinedAt + HOUR), true)
  assert.equal(inAdGracePeriod(JOINED, 9, joinedAt + 71 * HOUR), true)
  assert.equal(inAdGracePeriod(JOINED, null, joinedAt + HOUR), true) // 물건 수를 모르면 0개로 본다
})

test('3일이 지나거나 물건이 10개가 되면 광고를 보여 준다', () => {
  assert.equal(inAdGracePeriod(JOINED, 0, joinedAt + 72 * HOUR), false) // 정확히 3일
  assert.equal(inAdGracePeriod(JOINED, 3, joinedAt + 30 * 24 * HOUR), false)
  assert.equal(inAdGracePeriod(JOINED, 10, joinedAt + HOUR), false) // 첫날이라도 10개를 등록했으면
  assert.equal(inAdGracePeriod(JOINED, 250, joinedAt + HOUR), false)
})

test('가입일을 아직 모르면 숨기고, 읽을 수 없는 값이면 숨기지 않는다', () => {
  assert.equal(inAdGracePeriod(undefined, 0), true)
  assert.equal(inAdGracePeriod(null, 100), true)
  assert.equal(inAdGracePeriod('엉뚱한 값', 0), false)
})
