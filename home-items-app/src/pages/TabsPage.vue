<script setup lang="ts">
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonPage,
} from '@ionic/vue'
import { home, search, addCircle, fileTrayFull, person } from 'ionicons/icons'
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
        <ion-tab-button tab="places" href="/tabs/places">
          <ion-icon :icon="fileTrayFull" />
          <ion-label>보관 장소</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="profile" href="/tabs/profile">
          <ion-icon :icon="person" />
          <ion-label>내 정보</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>
