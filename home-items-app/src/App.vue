<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { IonApp, IonRouterOutlet, useBackButton, useIonRouter, toastController } from '@ionic/vue'
import { App } from '@capacitor/app'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { consumeCallbackUrl, isAuthCallbackUrl, readCallbackUrl } from '@/services/socialAuth'
import { adsSupported, setBannerVisible, shouldShowAds } from '@/services/ads'
import { itemCount, refreshItemCount, reportItemCount } from '@/services/itemCount'
import { inAdGracePeriod } from '@/utils/adGrace'
import { otaState } from '@/services/ota'

const ionRouter = useIonRouter()
const router = useRouter()
const auth = useAuthStore()
const route = useRoute()
let lastBackPress = 0

// 하단 배너 광고(안드로이드 앱 전용): 로그인한 뒤, 등록·수정·약관 화면이 아닐 때만 보인다.
// 신규 사용자(가입 3일 미만이면서 물건 10개 미만)에게는 보여 주지 않는다.
watch(
  () => [route.path, auth.isAuthenticated, auth.user?.createdAt, itemCount.value] as const,
  ([path, loggedIn, createdAt, itemCount]) =>
    void setBannerVisible(shouldShowAds(path, loggedIn, inAdGracePeriod(createdAt, itemCount))),
  { immediate: true },
)

// 로그인 직후 물건 수를 불러온다(하단 탭의 숫자 표시와 광고 유예 판정에 쓴다).
// 광고가 나오는 안드로이드 앱에서는 유예 판정에 필요한 가입일도 함께 불러온다. 실패하면 유예 상태(광고 숨김)로 남는다.
watch(
  () => auth.isAuthenticated,
  (loggedIn) => {
    if (!loggedIn) {
      reportItemCount(null)
      return
    }
    // 홈 화면은 목록을 불러오면서 물건 수도 함께 알려 주므로(DashboardPage), 거기서 시작할 때는 따로 묻지 않는다.
    if (route.path !== '/tabs/home') void refreshItemCount()
    if (adsSupported() && !auth.user) void auth.fetchMe().catch(() => {})
  },
  { immediate: true },
)

// 하드웨어 뒤로가기: 화면 이동은 Ionic 이 처리하고,
// 더 뒤로 갈 곳이 없는 루트에서는 "한 번 더 누르면 종료".
useBackButton(-1, () => {
  if (ionRouter.canGoBack()) return
  const now = Date.now()
  if (now - lastBackPress < 2000) {
    App.exitApp()
  } else {
    lastBackPress = now
    toastController
      .create({ message: '한 번 더 누르면 종료됩니다', duration: 1500, position: 'bottom' })
      .then((t) => t.present())
  }
})

// 소셜 로그인 딥링크를 받는 유일한 창구.
// signInWith() 가 기다리는 중이면 그쪽으로 넘기고, 대기자가 없을 때만 여기서 마무리한다.
let urlListener: PluginListenerHandle | null = null

// 콜드 스타트에서는 getLaunchUrl() 과 appUrlOpen 이 같은 URL 을 둘 다 줄 수 있다.
let lastHandledUrl = ''

async function handleDeepLink(url: string) {
  if (!isAuthCallbackUrl(url) || url === lastHandledUrl) return
  lastHandledUrl = url
  if (consumeCallbackUrl(url)) return // 로그인 화면이 대기 중 → 중복 처리 방지
  try {
    await auth.applyToken(readCallbackUrl(url))
    router.replace('/tabs/home')
  } catch {
    // 실패 메시지는 로그인 화면에서 처리한다.
  }
}

// 유통기한 알림을 누르면 그 물건 상세로 이동한다.
let notificationListener: PluginListenerHandle | null = null

onMounted(async () => {
  if (Capacitor.isNativePlatform()) {
    notificationListener = await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
      const itemId = Number(notification.extra?.itemId)
      if (itemId && auth.isAuthenticated) router.push(`/items/${itemId}`)
    })
  }
  urlListener = await App.addListener('appUrlOpen', ({ url }) => void handleDeepLink(url))
  // 앱이 종료된 상태에서 딥링크로 켜지면 리스너를 걸기 전에 이벤트가 지나간다.
  const launch = await App.getLaunchUrl()
  if (launch?.url) await handleDeepLink(launch.url)
})

onUnmounted(() => {
  void urlListener?.remove()
  urlListener = null
  void notificationListener?.remove()
  notificationListener = null
})
</script>

<template>
  <ion-app>
    <ion-router-outlet />
    <!-- 앱을 켤 때 새 버전을 받는 동안 보여 주는 화면 (services/ota.ts) -->
    <div v-if="otaState.active" class="ota-overlay" role="status" aria-live="polite">
      <img class="ota-icon" src="/pwa-192x192.png" alt="" />
      <p class="ota-title">업데이트 중</p>
      <p class="ota-sub">새 버전을 받고 있어요. 잠시만 기다려 주세요.</p>
      <div class="ota-bar"><div class="ota-bar-fill" :style="{ width: otaState.percent + '%' }" /></div>
      <p class="ota-percent">{{ otaState.percent }}%</p>
    </div>
  </ion-app>
</template>

<style>
.ota-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000; /* Ionic 의 팝업·토스트보다 위 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  background: var(--ion-background-color, #fff);
  text-align: center;
}
.ota-icon {
  width: 84px;
  height: 84px;
  border-radius: 20px;
  margin-bottom: 8px;
}
.ota-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.ota-sub {
  margin: 0;
  font-size: 14px;
  color: var(--ion-color-medium);
}
.ota-bar {
  width: min(240px, 70vw);
  height: 6px;
  margin-top: 14px;
  border-radius: 3px;
  background: var(--ion-color-light);
  overflow: hidden;
}
.ota-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--ion-color-primary);
  transition: width 0.2s ease;
}
.ota-percent {
  margin: 0;
  font-size: 13px;
  color: var(--ion-color-medium);
}
</style>
