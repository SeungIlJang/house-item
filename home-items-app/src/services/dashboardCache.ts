// 홈 화면에 마지막으로 보여 준 내용. 앱을 켜면 서버 응답을 기다리지 않고 이것부터 보여 주고, 응답이 오면 바꾼다.
// 기기에만 저장한다. 다른 계정으로 로그인하면 쓰지 않도록 계정(토큰의 사용자 번호)을 함께 적어 둔다.
import { getToken } from '@/api/client'
import type { Item } from '@/types/api'

const KEY = 'home_items_dashboard_cache'

export type DashboardData = { totalItems: number; recentItems: Item[]; expiringItems: Item[]; expiringTotal: number }

/** 로그인한 사용자의 번호(토큰의 sub). 읽지 못하면 빈 문자열. */
function currentUser(): string {
  try {
    const payload = getToken()?.split('.')[1] ?? ''
    return String(JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).sub ?? '')
  } catch {
    return ''
  }
}

export function readDashboardCache(): DashboardData | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    const user = currentUser()
    if (!user || saved?.user !== user || !Array.isArray(saved.data?.recentItems) || !Array.isArray(saved.data?.expiringItems)) return null
    return saved.data as DashboardData
  } catch {
    return null
  }
}

export function saveDashboardCache(data: DashboardData): void {
  const user = currentUser()
  if (!user) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ user, data }))
  } catch {
    // 저장 공간이 없어도 앱 사용에는 지장이 없다.
  }
}

export function clearDashboardCache(): void {
  localStorage.removeItem(KEY)
}
