// 유통기한 날짜 계산. 모두 사용자 기기의 현지 날짜 기준이다(서버는 UTC).

export function toLocalDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' → 그 날 현지 자정 */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

function atHour(d: Date, hour: number): Date {
  const copy = new Date(d)
  copy.setHours(hour, 0, 0, 0)
  return copy
}

/** 기준 시각의 날짜부터 만료일까지 남은 일수. 오늘 만료면 0, 지났으면 음수. */
export function daysUntil(expirationDate: string, from: Date = new Date()): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((parseLocalDate(expirationDate).getTime() - today.getTime()) / 86_400_000)
}

export function expiryLabel(days: number): string {
  if (days < 0) return `${-days}일 지남`
  if (days === 0) return '오늘 만료'
  return `D-${days}`
}

export type ExpiryTone = 'danger' | 'warning' | 'medium'
export function expiryTone(days: number): ExpiryTone {
  if (days <= 0) return 'danger'
  if (days <= 7) return 'warning'
  return 'medium'
}

// 알림 ID 는 이 값에 물건 ID 를 더해 만든다. 앱의 다른 알림과 겹치지 않고, 범위로 우리 알림만 골라 지울 수 있다.
export const REMINDER_ID_BASE = 1_000_000
// 안드로이드는 예약 알람 수에 제한이 있어 가까운 것부터 이만큼만 예약한다.
export const MAX_REMINDERS = 50

export type ReminderItem = { id: number; name: string; expirationDate: string | null }
export type ReminderPlan = { id: number; itemId: number; at: Date; title: string; body: string }

/**
 * 물건마다 알림 1개를 계획한다.
 * - 기본은 만료 daysBefore 일 전 hour 시.
 * - 그 시각이 이미 지났다면(늦게 등록한 경우) 다음 hour 시에 알린다. 단 만료일 hour 시를 넘기면 알리지 않는다.
 */
export function planReminders(items: ReminderItem[], daysBefore: number, hour: number, now: Date = new Date()): ReminderPlan[] {
  const plans: ReminderPlan[] = []
  for (const item of items) {
    if (!item.expirationDate) continue
    const expiration = parseLocalDate(item.expirationDate)
    const deadline = atHour(expiration, hour)
    let at = atHour(addDays(expiration, -daysBefore), hour)
    if (at <= now) {
      at = atHour(now, hour)
      if (at <= now) at = addDays(at, 1)
      if (at > deadline) continue
    }
    const days = daysUntil(item.expirationDate, at)
    plans.push({
      id: REMINDER_ID_BASE + item.id,
      itemId: item.id,
      at,
      title: item.name || '이름 없는 물건',
      body: days === 0 ? `오늘이 유통기한이에요 (${item.expirationDate})` : `유통기한이 ${days}일 남았어요 (${item.expirationDate})`,
    })
  }
  return plans.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_REMINDERS)
}
