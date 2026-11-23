<script setup lang="ts">
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
  IonRouterOutlet,
  IonPage,
} from '@ionic/vue'
import { computed } from 'vue'
import { home, search, addCircle, cube, person } from 'ionicons/icons'
import { formatBadge, itemCount } from '@/services/itemCount'

// 보관함 탭에 내가 등록한 물건 수를 붙인다. 등록하면 숫자가 늘어 "저기에 담겼다"는 것이 보인다.
const boxBadge = computed(() => formatBadge(itemCount.value))
</script>

<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon :icon="home" />
          <ion-label>홈</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="search" href="/tabs/search">
          <ion-icon :icon="search" />
          <ion-label>찾기</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="add" href="/tabs/add">
          <ion-icon :icon="addCircle" />
          <ion-label>등록</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="box" href="/tabs/box">
          <ion-icon :icon="cube" />
          <ion-label>보관함</ion-label>
          <ion-badge v-if="boxBadge" color="primary" class="count-badge">{{ boxBadge }}</ion-badge>
        </ion-tab-button>
        <ion-tab-button tab="profile" href="/tabs/profile">
          <ion-icon :icon="person" />
          <ion-label>내 정보</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>
