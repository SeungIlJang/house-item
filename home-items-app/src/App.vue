<script setup lang="ts">
import { IonApp, IonRouterOutlet, useBackButton, useIonRouter, toastController } from '@ionic/vue'
import { App } from '@capacitor/app'

const ionRouter = useIonRouter()
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
</script>

<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>
