// 서비스 워커(PWA 캐시)는 웹 버전에서만 쓴다.
//
// 안드로이드 앱에서는 쓰면 안 된다. 서비스 워커가 예전 화면 파일을 캐시에서 내주기 때문에,
// OTA 로 새 묶음을 적용해도(화면을 다시 띄워도) 예전 화면이 그대로 뜬다. 그러면 앱은
// "새 묶음이 되돌려졌다"고 잘못 판단해 그 버전을 다시 받지도 않는다(services/ota.ts).
// 앱은 화면 파일을 기기 안에서 바로 읽으므로 캐시가 필요 없다.
import { Capacitor } from '@capacitor/core'

const RELOADED_KEY = 'home_items_sw_removed'

/**
 * 앱 시작 때 한 번 부른다.
 * - 웹: 서비스 워커를 등록한다.
 * - 앱: 남아 있는 서비스 워커와 캐시를 지운다. 지금 화면이 서비스 워커의 캐시에서 뜬 것이면
 *   화면을 한 번 다시 띄우고 true 를 돌려준다(이때는 앱을 띄우지 말고 기다린다).
 */
export async function setupServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false

  if (!Capacitor.isNativePlatform()) {
    if (import.meta.env.PROD) {
      window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {}))
    }
    return false
  }

  try {
    const controlled = Boolean(navigator.serviceWorker.controller)
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
    if ('caches' in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
    // 등록을 지워도 지금 화면은 여전히 캐시에서 뜬 예전 화면이다. 한 번만 다시 띄운다(반복 방지).
    if (controlled && !sessionStorage.getItem(RELOADED_KEY)) {
      sessionStorage.setItem(RELOADED_KEY, '1')
      window.location.reload()
      return true
    }
  } catch (error) {
    console.warn('서비스 워커 정리 실패', error)
  }
  return false
}
