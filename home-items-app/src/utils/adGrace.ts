// 신규 사용자 광고 유예. 앱을 처음 써 보는 동안에는 광고로 방해하지 않는다.
//
// 규칙: "가입한 지 AD_GRACE_DAYS 일이 안 됐고, 등록한 물건이 AD_GRACE_ITEMS 개 미만"인 동안 광고를 숨긴다.
// 둘 중 하나라도 넘으면 광고를 보여 준다. (물건 수만 조건으로 두면 가볍게 쓰는 사용자에게는 광고가 영영 나오지 않는다)
export const AD_GRACE_DAYS = 3
export const AD_GRACE_ITEMS = 10

const DAY_MS = 24 * 60 * 60 * 1000

/** 서버 시각('YYYY-MM-DD HH:MM:SS', UTC) 또는 ISO 문자열을 밀리초로 바꾼다. 못 읽으면 null. */
export function parseServerTime(value: string | null | undefined): number | null {
  if (!value) return null
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const time = Date.parse(iso)
  return Number.isNaN(time) ? null : time
}

/**
 * 지금 광고를 숨겨야 하는 신규 사용자인지.
 * - createdAt 을 아직 모르면(내 정보를 불러오기 전) 숨긴다: 신규 사용자에게 잠깐이라도 광고가 뜨지 않게.
 * - createdAt 을 읽을 수 없으면 숨기지 않는다: 형식이 바뀌어도 광고가 영영 사라지지 않게.
 * - itemCount 를 모르면 0개로 본다.
 */
export function inAdGracePeriod(createdAt: string | null | undefined, itemCount: number | null, now: number = Date.now()): boolean {
  if (!createdAt) return true
  const joinedAt = parseServerTime(createdAt)
  if (joinedAt === null) return false
  const isNew = now - joinedAt < AD_GRACE_DAYS * DAY_MS
  return isNew && (itemCount ?? 0) < AD_GRACE_ITEMS
}
