// OTA(원격) 업데이트: 스토어 심사 없이 앱 화면(웹 묶음)을 새 버전으로 바꾼다. 안드로이드 앱 전용.
//
// 동작:
//   1. 앱이 켜지면 웹 버전 주소의 /ota/manifest.json 을 확인한다.
//   2. 지금 실행 중인 묶음보다 새 버전이면 "업데이트 중" 화면을 띄우고 zip 을 내려받아 바로 적용한다(화면이 새로 뜬다).
//      내려받기가 너무 오래 걸리면 화면을 닫고 뒤에서 마저 받아, 다음 실행 때 적용한다.
//   3. 앱을 쓰다가 다시 앞으로 왔을 때 새 버전이 있으면, 방해하지 않도록 뒤에서 받아 다음 실행 때 적용한다.
//   4. 새 묶음이 뜨면 confirmBundleReady() 로 정상 실행을 알린다.
//      알리지 못하면(새 묶음이 깨져 있으면) 플러그인이 이전 묶음으로 자동으로 되돌린다.
//      되돌려진 버전은 기록해 두고 다시 받지 않는다(실행할 때마다 업데이트를 반복하지 않도록).
//
// 바꿀 수 있는 것은 웹 코드(화면·로직)뿐이다. 네이티브 플러그인 추가, 권한, 아이콘, 앱 이름은
// 스토어 업데이트가 필요하다. 그런 변경을 넣을 때는 ota.config.json 의 minNativeBuild 를 올린다.
//
// 묶음은 `npm run deploy:web` 이 만들어 웹 버전과 함께 올린다(scripts/build-ota.mjs).
import { ref } from 'vue'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater'

const MANIFEST_URL: string =
  import.meta.env.VITE_OTA_MANIFEST_URL || 'https://home-items.season-masil.workers.dev/ota/manifest.json'

/** 지금 실행 중인 웹 묶음의 버전과 빌드 시각(빌드 때 박힌다). */
export const APP_BUILD: string = __APP_BUILD__
const APP_BUILT_AT: number = __APP_BUILT_AT__

type Manifest = { version: string; builtAt: number; url: string; minNativeBuild?: number }

// "업데이트 중" 화면의 상태(App.vue 가 그린다). percent 는 내려받은 비율(0~100).
export const otaState = ref({ active: false, percent: 0 })

const MANIFEST_TIMEOUT_MS = 4000 // 실행을 오래 붙잡지 않도록, 확인이 늦으면 건너뛴다
const DOWNLOAD_WAIT_MS = 25000 // 이 시간 안에 못 받으면 화면을 닫고 뒤에서 마저 받는다
const RESUME_CHECK_INTERVAL_MS = 30 * 60 * 1000

// 적용을 시도한 버전과, 적용했다가 되돌려진 버전. 기기에만 저장한다.
const ATTEMPT_KEY = 'home_items_ota_attempt'
const FAILED_KEY = 'home_items_ota_failed'

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

/**
 * 지난번에 적용을 시도한 버전이 지금 실행 중인지 확인한다.
 * 시도했는데 다른 버전으로 떠 있다면 그 묶음이 깨져서 되돌려진 것이므로, 다시 받지 않게 기록한다.
 */
function settleLastAttempt(): void {
  const attempted = localStorage.getItem(ATTEMPT_KEY)
  if (!attempted) return
  if (attempted !== APP_BUILD) localStorage.setItem(FAILED_KEY, attempted)
  localStorage.removeItem(ATTEMPT_KEY)
}

/** 받을 만한 새 버전이 있으면 그 안내 정보를 돌려준다. 없거나 확인하지 못하면 null. */
async function findUpdate(timeoutMs: number): Promise<Manifest | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return null
    const manifest = (await res.json()) as Manifest
    if (!manifest?.version || !manifest.url || !Number.isFinite(manifest.builtAt)) return null

    // 더 새 묶음만 받는다. 스토어로 받은 앱이 웹보다 최신이면 옛 묶음으로 내려가지 않는다.
    if (manifest.version === APP_BUILD || manifest.builtAt <= APP_BUILT_AT) return null
    // 적용했다가 되돌려진 버전은 다시 받지 않는다. 다음 배포(새 버전)가 나오면 그때 받는다.
    if (manifest.version === localStorage.getItem(FAILED_KEY)) return null

    // 새 묶음이 이 앱(네이티브 껍데기)에 없는 플러그인을 쓸 수 있으면 건너뛴다. 스토어 업데이트를 기다린다.
    const { build } = await App.getInfo()
    if (Number(build) < Number(manifest.minNativeBuild ?? 0)) return null
    return manifest
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 이미 받아 둔 묶음이 있으면 그것을, 없으면 내려받는다. */
async function fetchBundle(manifest: Manifest): Promise<BundleInfo> {
  const { bundles } = await CapacitorUpdater.list()
  const ready = bundles.find((b) => b.version === manifest.version && (b.status === 'success' || b.status === 'pending'))
  return ready ?? CapacitorUpdater.download({ url: manifest.url, version: manifest.version })
}

/** 앱을 켤 때: 새 버전이 있으면 "업데이트 중" 화면을 띄우고 받아서 바로 적용한다. */
async function updateOnLaunch(): Promise<void> {
  const manifest = await findUpdate(MANIFEST_TIMEOUT_MS)
  if (!manifest) return

  otaState.value = { active: true, percent: 0 }
  const progress = await CapacitorUpdater.addListener('download', ({ percent }) => {
    otaState.value = { active: otaState.value.active, percent: Math.max(otaState.value.percent, Math.round(percent)) }
  })
  try {
    const download = fetchBundle(manifest)
    const timedOut = Symbol('timeout')
    const result = await Promise.race([
      download,
      new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), DOWNLOAD_WAIT_MS)),
    ])
    if (result === timedOut) {
      // 너무 오래 걸리면 기다리게 하지 않는다. 뒤에서 마저 받아 다음 실행 때 적용한다.
      void download
        .then((bundle) => {
          localStorage.setItem(ATTEMPT_KEY, manifest.version)
          return CapacitorUpdater.next({ id: bundle.id })
        })
        .catch(() => {})
      return
    }
    otaState.value = { active: true, percent: 100 }
    localStorage.setItem(ATTEMPT_KEY, manifest.version)
    await CapacitorUpdater.set({ id: result.id }) // 새 묶음으로 화면이 다시 뜬다
  } catch (error) {
    console.warn('OTA 업데이트 실패', error)
  } finally {
    void progress.remove()
    otaState.value = { active: false, percent: 0 }
  }
}

let lastResumeCheck = Date.now()
let checking = false

/** 쓰는 도중(다시 앞으로 왔을 때): 방해하지 않고 뒤에서 받아 다음 실행 때 적용한다. */
async function updateInBackground(): Promise<void> {
  if (checking || Date.now() - lastResumeCheck < RESUME_CHECK_INTERVAL_MS) return
  checking = true
  lastResumeCheck = Date.now()
  try {
    const manifest = await findUpdate(MANIFEST_TIMEOUT_MS)
    if (!manifest) return
    const bundle = await fetchBundle(manifest)
    localStorage.setItem(ATTEMPT_KEY, manifest.version)
    await CapacitorUpdater.next({ id: bundle.id })
  } catch (error) {
    console.warn('OTA 업데이트 확인 실패', error)
  } finally {
    checking = false
  }
}

/** 앱 시작 시 한 번 호출한다. */
export async function startOta(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await confirmBundleReady()
  if (!otaSupported()) return
  settleLastAttempt()
  await updateOnLaunch()
  await App.addListener('resume', () => void updateInBackground())
}

// 개발 중에 "업데이트 중" 화면을 브라우저에서 띄워 볼 수 있게 한다(운영 빌드에는 들어가지 않는다).
if (import.meta.env.DEV) (window as unknown as { __otaState: typeof otaState }).__otaState = otaState
