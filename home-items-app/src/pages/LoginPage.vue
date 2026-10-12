<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { IonPage, IonContent, IonButton, IonIcon, IonSpinner, IonText } from '@ionic/vue'
import { logoGoogle, chatbubbleEllipses } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { PROVIDER_LABEL, SocialAuthError, type SocialProvider } from '@/services/socialAuth'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const pending = ref<SocialProvider | null>(null)

async function signIn(provider: SocialProvider) {
  if (pending.value) return
  pending.value = provider
  try {
    await auth.loginWith(provider)
    router.replace('/tabs/home')
  } catch (e) {
    // 사용자가 직접 취소한 경우는 오류로 알리지 않는다.
    if (e instanceof SocialAuthError && e.code === 'ACCESS_DENIED') return
    toast.error(e instanceof Error ? e.message : '로그인에 실패했습니다.')
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="login-wrap">
        <h1 class="title">집안의모든것</h1>
        <p class="subtitle">우리 집 물건, 어디에 뒀는지 바로 찾기</p>

        <div class="providers">
          <ion-button
            expand="block"
            class="provider google"
            :disabled="pending !== null"
            @click="signIn('google')"
          >
            <ion-spinner v-if="pending === 'google'" name="crescent" slot="start" />
            <ion-icon v-else :icon="logoGoogle" slot="start" />
            {{ PROVIDER_LABEL.google }}로 계속하기
          </ion-button>

          <ion-button
            expand="block"
            class="provider kakao"
            :disabled="pending !== null"
            @click="signIn('kakao')"
          >
            <ion-spinner v-if="pending === 'kakao'" name="crescent" slot="start" />
            <ion-icon v-else :icon="chatbubbleEllipses" slot="start" />
            {{ PROVIDER_LABEL.kakao }}로 계속하기
          </ion-button>
        </div>

        <ion-text color="medium">
          <p class="notice">
            로그인하면 서비스 이용약관과 개인정보 처리방침에 동의하는 것으로 봅니다.
          </p>
        </ion-text>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.login-wrap {
  max-width: 420px;
  margin: 0 auto;
  padding-top: 18vh;
}
.title {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 6px;
}
.subtitle {
  text-align: center;
  color: var(--ion-color-medium);
  margin: 0 0 40px;
}
.providers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.provider {
  --border-radius: 10px;
  height: 50px;
  font-weight: 600;
  text-transform: none;
}
.provider.google {
  --background: #ffffff;
  --background-activated: #f1f3f4;
  --color: #1f1f1f;
  --border-color: #dadce0;
  --border-style: solid;
  --border-width: 1px;
}
.provider.kakao {
  --background: #fee500;
  --background-activated: #f0d900;
  --color: #191600;
}
.notice {
  margin-top: 28px;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
</style>
