<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonInput,
  IonButton,
  IonItem,
  IonList,
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/api/client'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const email = ref('')
const password = ref('')
const name = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!email.value || !password.value || !name.value) {
    toast.error('모든 항목을 입력해주세요.')
    return
  }
  if (password.value.length < 8) {
    toast.error('비밀번호는 8자 이상이어야 합니다.')
    return
  }
  loading.value = true
  try {
    await auth.signup(email.value, password.value, name.value)
    toast.success('회원가입이 완료되었습니다.')
    router.replace('/tabs/home')
  } catch (e) {
    toast.error(extractErrorMessage(e, '회원가입에 실패했습니다.'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/login" />
        </ion-buttons>
        <ion-title>회원가입</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-input label="이름" label-placement="stacked" v-model="name" placeholder="홍길동" />
        </ion-item>
        <ion-item>
          <ion-input
            label="이메일"
            label-placement="stacked"
            type="email"
            v-model="email"
            placeholder="you@example.com"
          />
        </ion-item>
        <ion-item>
          <ion-input
            label="비밀번호 (8자 이상)"
            label-placement="stacked"
            type="password"
            v-model="password"
            placeholder="비밀번호"
          />
        </ion-item>
      </ion-list>
      <ion-button expand="block" class="ion-margin-top" :disabled="loading" @click="onSubmit">
        {{ loading ? '가입 중...' : '가입하기' }}
      </ion-button>
    </ion-content>
  </ion-page>
</template>
