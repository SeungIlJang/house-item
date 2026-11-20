<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { IonApp, IonRouterOutlet, useBackButton, useIonRouter, toastController } from '@ionic/vue'
import { App } from '@capacitor/app'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { consumeCallbackUrl, isAuthCallbackUrl, readCallbackUrl } from '@/services/socialAuth'
import { setBannerVisible, shouldShowAds } from '@/services/ads'

const ionRouter = useIonRouter()
const router = useRouter()
const auth = useAuthStore()
const route = useRoute()
let lastBackPress = 0

// 하단 배너 광고: 로그인한 뒤, 등록·수정·약관 화면이 아닐 때만 보인다(안드로이드 앱 전용).
watch(
  () => [route.path, auth.isAuthenticated] as const,
  ([path, loggedIn]) => void setBannerVisible(shouldShowAds(path, loggedIn)),
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
  </ion-app>
</template>
