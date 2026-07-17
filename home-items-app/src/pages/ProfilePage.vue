<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  onIonViewWillEnter,
} from '@ionic/vue'
import { pricetagsOutline, gridOutline, logOutOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

onIonViewWillEnter(() => {
  auth.fetchMe()
})

function logout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>내 정보</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="profile ion-padding">
        <div class="avatar">{{ auth.user?.name?.[0] ?? '👤' }}</div>
        <h2>{{ auth.user?.name ?? '사용자' }}</h2>
        <p class="email">{{ auth.user?.email }}</p>
      </div>

      <ion-list>
        <ion-item button @click="router.push('/categories')">
          <ion-icon slot="start" :icon="gridOutline" />
          <ion-label>카테고리 관리</ion-label>
        </ion-item>
        <ion-item button @click="router.push('/tags')">
          <ion-icon slot="start" :icon="pricetagsOutline" />
          <ion-label>태그 관리</ion-label>
        </ion-item>
      </ion-list>

      <div class="ion-padding">
        <ion-button expand="block" fill="outline" color="danger" @click="logout">
          <ion-icon slot="start" :icon="logOutOutline" />
          로그아웃
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.profile {
  text-align: center;
}
.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: #fff;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}
.email {
  color: var(--ion-color-medium);
}
</style>
