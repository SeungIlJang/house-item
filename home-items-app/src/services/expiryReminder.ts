// 유통기한 알림. 서버 비용 없이 기기의 로컬 알림으로 예약한다(네이티브 앱에서만 동작).
//
// 물건을 저장·삭제하거나 홈 화면에 들어올 때 다시 맞춘다: 우리 알림을 모두 지우고, 앞으로 만료될 물건으로 새로 예약.
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { itemApi } from '@/api'
import { REMINDER_ID_BASE, addDays, planReminders, toLocalDateString } from '@/utils/expiry'

const SETTINGS_KEY = 'home_items_expiry_reminder'
export const REMINDER_HOUR = 9
// 이 기간 안에 만료되는 물건만 예약한다. 더 먼 것은 나중에 앱을 열 때 예약된다.
const LOOKAHEAD_DAYS = 60

export type ReminderSettings = { enabled: boolean; daysBefore: number }
const DEFAULT_SETTINGS: ReminderSettings = { enabled: true, daysBefore: 3 }

export const remindersSupported = () => Capacitor.isNativePlatform()

export function getReminderSettings(): ReminderSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')
    return { ...DEFAULT_SETTINGS, ...(saved ?? {}) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveReminderSettings(settings: ReminderSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export async function cancelExpiryReminders(): Promise<void> {
  if (!remindersSupported()) return
  const { notifications } = await LocalNotifications.getPending()
  const ours = notifications.filter((n) => n.id >= REMINDER_ID_BASE)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
}

/** 알림 권한이 있는지 확인하고, 아직 묻지 않았다면 묻는다. */
async function ensurePermission(): Promise<boolean> {
  let status = await LocalNotifications.checkPermissions()
  if (status.display === 'prompt' || status.display === 'prompt-with-rationale') {
    status = await LocalNotifications.requestPermissions()
  }
  return status.display === 'granted'
}

let running: Promise<void> | null = null

/** 예약을 현재 물건 목록에 맞춘다. 실패해도 앱 사용을 막지 않도록 오류는 삼킨다. */
export function syncExpiryReminders(): Promise<void> {
  if (!remindersSupported()) return Promise.resolve()
  // 홈 진입과 저장이 겹쳐도 한 번에 하나만 돈다.
  running ??= (async () => {
    try {
      await cancelExpiryReminders()
      const settings = getReminderSettings()
      if (!settings.enabled || !(await ensurePermission())) return
      const cutoff = toLocalDateString(addDays(new Date(), LOOKAHEAD_DAYS))
      const page = await itemApi.search({ expiresBefore: cutoff, sort: 'expiration', size: 100 })
      const plans = planReminders(page.content, settings.daysBefore, REMINDER_HOUR)
      if (!plans.length) return
      await LocalNotifications.schedule({
        notifications: plans.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          schedule: { at: p.at, allowWhileIdle: true },
          // 플러그인 8.3 부터 기본값(true)이면 예약할 때마다 시스템의 "알람 및 리마인더" 설정 화면이 열린다.
          // 앱이 그 권한을 선언하지 않아 사용자가 켤 수도 없으므로, 정확한 알람을 요구하지 않는다(몇 분 늦게 울릴 수 있다).
          isExactNotification: false,
          extra: { kind: 'expiry', itemId: p.itemId },
        })),
      })
    } catch (error) {
      console.warn('유통기한 알림 예약 실패', error)
    } finally {
      running = null
    }
  })()
  return running
}
