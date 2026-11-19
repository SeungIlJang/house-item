<script setup lang="ts">
// 약관 · 개인정보 처리방침 · 계정 삭제 안내를 보여 주는 공통 화면.
// 로그인하지 않아도 열 수 있어야 한다(스토어 등록용 공개 주소).
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, useIonRouter } from '@ionic/vue'
import { arrowBackOutline } from 'ionicons/icons'
import { getToken } from '@/api/client'
import { DOCUMENTS } from '@/legal/documents'

const route = useRoute()
const ionRouter = useIonRouter()

const doc = computed(() => DOCUMENTS[route.meta.doc as keyof typeof DOCUMENTS]())

// 주소로 바로 들어온 경우에는 돌아갈 화면이 없으므로 로그인 여부에 맞는 첫 화면으로 보낸다.
function goBack() {
  if (ionRouter.canGoBack()) ionRouter.back()
  else ionRouter.navigate(getToken() ? '/tabs/profile' : '/login', 'back', 'replace')
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button aria-label="뒤로" @click="goBack">
            <ion-icon slot="icon-only" :icon="arrowBackOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ doc.title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <article class="legal">
        <h1>{{ doc.title }}</h1>
        <p class="intro">{{ doc.intro }}</p>
        <section v-for="section in doc.sections" :key="section.heading">
          <h2>{{ section.heading }}</h2>
          <ul v-if="section.bullets">
            <li v-for="line in section.bullets" :key="line">{{ line }}</li>
          </ul>
          <p v-for="line in section.paragraphs ?? []" :key="line">{{ line }}</p>
        </section>
      </article>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.legal {
  max-width: 720px;
  margin: 0 auto;
  line-height: 1.7;
  font-size: 15px;
}
h1 {
  font-size: 22px;
  font-weight: 700;
  margin: 8px 0 12px;
}
h2 {
  font-size: 16px;
  font-weight: 700;
  margin: 24px 0 8px;
}
.intro {
  color: var(--ion-color-medium);
}
ul {
  padding-left: 20px;
  margin: 8px 0;
}
li {
  margin: 4px 0;
}
</style>
