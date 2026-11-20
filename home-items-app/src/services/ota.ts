// OTA(원격) 업데이트: 스토어 심사 없이 앱 화면(웹 묶음)을 새 버전으로 바꾼다. 안드로이드 앱 전용.
//
// 동작:
//   1. 앱이 켜지거나 다시 앞으로 올 때 웹 버전 주소의 /ota/manifest.json 을 확인한다.
//   2. 지금 실행 중인 묶음보다 새 버전이면 zip 을 내려받아 "다음 실행 때 적용"으로 예약한다.
//      (쓰는 도중에 화면이 바뀌지 않도록, 앱이 백그라운드로 가거나 다시 켜질 때 적용된다)
//   3. 새 묶음이 뜨면 confirmBundleReady() 로 정상 실행을 알린다.
//      알리지 못하면(새 묶음이 깨져 있으면) 플러그인이 이전 묶음으로 자동으로 되돌린다.
//
// 바꿀 수 있는 것은 웹 코드(화면·로직)뿐이다. 네이티브 플러그인 추가, 권한, 아이콘, 앱 이름은
// 스토어 업데이트가 필요하다. 그런 변경을 넣을 때는 ota.config.json 의 minNativeBuild 를 올린다.
//
// 묶음은 `npm run deploy:web` 이 만들어 웹 버전과 함께 올린다(scripts/build-ota.mjs).
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

const MANIFEST_URL: string =
  import.meta.env.VITE_OTA_MANIFEST_URL || 'https://home-items.season-masil.workers.dev/ota/manifest.json'

/** 지금 실행 중인 웹 묶음의 버전과 빌드 시각(빌드 때 박힌다). */
export const APP_BUILD: string = __APP_BUILD__
const APP_BUILT_AT: number = __APP_BUILT_AT__

type Manifest = { version: string; builtAt: number; url: string; minNativeBuild?: number }

const CHECK_INTERVAL_MS = 30 * 60 * 1000
let lastCheck = 0
let checking = false

const otaSupported = () => Capacitor.isNativePlatform() && import.meta.env.PROD

/** 새 묶음이 정상적으로 떴음을 알린다. 앱 시작 직후(10초 안에) 불러야 자동 되돌리기가 일어나지 않는다. */
export async function confirmBundleReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await CapacitorUpdater.notifyAppReady()
  } catch (error) {
    console.warn('OTA 준비 알림 실패', error)
  }
}

/** 새 버전이 있으면 내려받아 다음 실행 때 적용되게 한다. 실패해도 앱 사용에는 영향이 없다. */
export async function checkForUpdate(): Promise<void> {
  if (!otaSupported() || checking || Date.now() - lastCheck < CHECK_INTERVAL_MS) return
  checking = true
  lastCheck = Date.now()
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' })
    if (!res.ok) return
    const manifest = (await res.json()) as Manifest
    if (!manifest?.version || !manifest.url || !Number.isFinite(manifest.builtAt)) return

    // 더 새 묶음만 받는다. 스토어로 받은 앱이 웹보다 최신이면 옛 묶음으로 내려가지 않는다.
    if (manifest.version === APP_BUILD || manifest.builtAt <= APP_BUILT_AT) return

    // 새 묶음이 이 앱(네이티브 껍데기)에 없는 플러그인을 쓸 수 있으면 건너뛴다. 스토어 업데이트를 기다린다.
    const { build } = await App.getInfo()
    if (Number(build) < Number(manifest.minNativeBuild ?? 0)) return

    // 이미 받아 둔 버전이면 다시 내려받지 않는다.
    const { bundles } = await CapacitorUpdater.list()
    const downloaded = bundles.find((b) => b.version === manifest.version && b.status !== 'error')
    const bundle = downloaded ?? (await CapacitorUpdater.download({ url: manifest.url, version: manifest.version }))
    await CapacitorUpdater.next({ id: bundle.id })
  } catch (error) {
    console.warn('OTA 업데이트 확인 실패', error)
  } finally {
    checking = false
  }
}

/** 앱 시작 시 한 번 호출한다. 정상 실행을 알리고, 시작할 때와 다시 앞으로 올 때 업데이트를 확인한다. */
export async function startOta(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await confirmBundleReady()
  void checkForUpdate()
  await App.addListener('resume', () => void checkForUpdate())
}
