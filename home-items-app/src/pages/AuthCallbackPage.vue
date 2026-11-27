<script setup lang="ts">
// 웹 소셜 로그인 복귀 화면.
// 서버가 /auth/callback#state=...&token=... 으로 돌려보내면 토큰을 저장하고 홈으로 간다.
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { IonPage, IonContent, IonSpinner } from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { showAlert } from '@/composables/useAlert'
import { SocialAuthError, WEB_CALLBACK_PATH, describeLoginError, readCallbackUrl } from '@/services/socialAuth'
import { tr } from '@/i18n'

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  const url = window.location.href
  // 토큰이 주소창·방문 기록에 남지 않도록 바로 지운다.
  window.history.replaceState(window.history.state, '', WEB_CALLBACK_PATH)
  try {
    await auth.applyToken(readCallbackUrl(url))
    await router.replace('/tabs/home')
  } catch (e) {
    await router.replace('/login')
    // 사용자가 직접 취소한 경우는 오류로 알리지 않는다. 그 외에는 원인과 오류 코드를 팝업으로 보여 준다.
    if (!(e instanceof SocialAuthError && e.code === 'ACCESS_DENIED')) {
      const { title, message } = describeLoginError(e)
      await showAlert(title, message)
    }
  }
})
</script>

<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="center">
        <ion-spinner name="crescent" />
        <p>{{ tr('로그인 중...', 'Signing in...') }}</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 30vh;
  color: var(--ion-color-medium);
}
</style>
