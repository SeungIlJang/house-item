<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonItem,
  IonList,
  IonText,
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/api/client'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!email.value || !password.value) {
    toast.error('이메일과 비밀번호를 입력해주세요.')
    return
  }
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.replace('/tabs/home')
  } catch (e) {
    toast.error(extractErrorMessage(e, '로그인에 실패했습니다.'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="login-wrap">
        <h1 class="title">집안의모든것</h1>
        <p class="subtitle">우리 집 물건, 어디에 뒀는지 바로 찾기</p>

        <ion-list>
          <ion-item>
            <ion-input
              label="이메일"
              label-placement="stacked"
              type="email"
              v-model="email"
              placeholder="you@example.com"
              autocomplete="email"
            />
          </ion-item>
          <ion-item>
            <ion-input
              label="비밀번호"
              label-placement="stacked"
              type="password"
              v-model="password"
              placeholder="비밀번호"
              @keyup.enter="onSubmit"
            />
          </ion-item>
        </ion-list>

        <ion-button expand="block" class="ion-margin-top" :disabled="loading" @click="onSubmit">
          {{ loading ? '로그인 중...' : '로그인' }}
        </ion-button>

        <ion-text color="medium">
          <p class="signup-hint">
            계정이 없으신가요?
            <router-link to="/signup">회원가입</router-link>
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
  padding-top: 12vh;
}
.title {
  text-align: center;
  font-weight: 700;
  margin-bottom: 4px;
}
.subtitle {
  text-align: center;
  color: var(--ion-color-medium);
  margin-bottom: 24px;
}
.signup-hint {
  text-align: center;
  margin-top: 16px;
}
</style>
