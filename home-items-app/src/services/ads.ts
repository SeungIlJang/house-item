// 하단 배너 광고 (Google AdMob). 안드로이드 앱에서만 동작하고 웹에서는 아무것도 하지 않는다.
//
// 배너는 웹 화면 위에 덮이는 네이티브 뷰라서, 가려지지 않도록 배너 높이만큼 앱 전체(ion-app)를 위로 올린다.
// 그래서 화면 맨 아래에 배너, 그 위에 하단 탭 메뉴가 온다.
//
// 설정:
// - 광고 단위 ID: 빌드 시 VITE_ADMOB_BANNER_ID. 없거나 개발 빌드면 구글의 테스트 광고를 쓴다.
//   (내 앱의 실제 광고를 직접 누르면 AdMob 정책 위반이므로 개발 중에는 반드시 테스트 광고를 쓴다)
// - AdMob 앱 ID: android/app/src/main/AndroidManifest.xml 의
//   com.google.android.gms.ads.APPLICATION_ID 메타데이터. 없으면 앱이 시작하자마자 종료된다(README 참고).
import { Capacitor } from '@capacitor/core'
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob'

// 구글이 공개한 안드로이드 배너 테스트 광고 단위
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'
const REAL_BANNER_ID: string = import.meta.env.VITE_ADMOB_BANNER_ID ?? ''
const USE_TEST_AD = !import.meta.env.PROD || !REAL_BANNER_ID

// 배너와 하단 탭 메뉴 사이 간격. 탭을 누르려다 광고를 잘못 누르는 일을 줄인다(AdMob 정책).
const GAP_PX = 6

// 광고를 띄우지 않는 화면: 로그인 전, 약관 문서, 그리고 입력에 집중해야 하는 등록·수정 화면
const HIDDEN_PATHS = [/^\/login$/, /^\/auth\//, /^\/terms$/, /^\/privacy$/, /^\/account-deletion$/, /^\/tabs\/add$/, /^\/items\/\d+\/edit$/]

export const adsSupported = () => Capacitor.getPlatform() === 'android'
export const shouldShowAds = (path: string, loggedIn: boolean) => loggedIn && !HIDDEN_PATHS.some((p) => p.test(path))

let ready: Promise<boolean> | null = null
let created = false
let visible = false
let bannerHeight = 0
let queue: Promise<void> = Promise.resolve()

function applyLayout() {
  const app = document.querySelector<HTMLElement>('ion-app')
  if (app) app.style.marginBottom = visible && bannerHeight > 0 ? `${bannerHeight + GAP_PX}px` : ''
}

/** SDK 초기화와 광고 동의 확인(최초 1회). 실패하면 광고 없이 계속 쓴다. */
function init(): Promise<boolean> {
  ready ??= (async () => {
    try {
      await AdMob.initialize()
      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
        bannerHeight = size.height
        applyLayout()
      })
      // 유럽 등 동의가 필요한 지역에서는 구글의 동의 화면을 띄운다. AdMob 에 동의 메시지를 설정하지 않았으면 건너뛴다.
      try {
        const consent = await AdMob.requestConsentInfo()
        if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm()
      } catch (error) {
        console.warn('광고 동의 확인 건너뜀', error)
      }
      return true
    } catch (error) {
      console.warn('광고 초기화 실패', error)
      return false
    }
  })()
  return ready
}

/** 배너를 보이거나 숨긴다. 화면 전환마다 호출해도 되도록 순서대로 처리한다. */
export function setBannerVisible(show: boolean): Promise<void> {
  if (!adsSupported()) return Promise.resolve()
  queue = queue.then(async () => {
    if (show === visible) return
    try {
      if (show) {
        if (!(await init())) return
        if (created) {
          await AdMob.resumeBanner()
        } else {
          await AdMob.showBanner({
            adId: USE_TEST_AD ? TEST_BANNER_ID : REAL_BANNER_ID,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: USE_TEST_AD,
          })
          created = true
        }
      } else if (created) {
        await AdMob.hideBanner()
      }
      visible = show
      applyLayout()
    } catch (error) {
      // 광고가 안 떠도 앱 사용에는 지장이 없어야 한다.
      console.warn('배너 광고 처리 실패', error)
    }
  })
  return queue
}
