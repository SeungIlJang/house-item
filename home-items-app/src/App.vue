<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { IonApp, IonRouterOutlet, useBackButton, useIonRouter, toastController } from '@ionic/vue'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { readCallbackUrl } from '@/services/socialAuth'

const ionRouter = useIonRouter()
const router = useRouter()
const auth = useAuthStore()
let lastBackPress = 0

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

// 소셜 로그인 딥링크. 로그인 화면이 띄워지기 전에 돌아오거나,
// 앱이 재시작된 경우를 대비해 전역에서도 한 번 더 받는다.
let urlListener: PluginListenerHandle | null = null

onMounted(async () => {
  urlListener = await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.includes('token=') && !url.includes('error=')) return
    try {
      await auth.applyToken(readCallbackUrl(url))
      router.replace('/tabs/home')
    } catch {
      // 실패 메시지는 로그인 화면에서 처리한다.
    }
  })
})

onUnmounted(() => {
  void urlListener?.remove()
  urlListener = null
})
</script>

<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>
