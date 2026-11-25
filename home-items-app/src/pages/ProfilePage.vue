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
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonListHeader,
  alertController,
  loadingController,
  onIonViewWillEnter,
} from '@ionic/vue'
import { ref } from 'vue'
import { pricetagsOutline, gridOutline, logOutOutline, notificationsOutline, timeOutline, documentTextOutline, shieldCheckmarkOutline, homeOutline } from 'ionicons/icons'
import {
  REMINDER_HOUR,
  getReminderSettings,
  remindersSupported,
  saveReminderSettings,
  syncExpiryReminders,
} from '@/services/expiryReminder'
import { useAuthStore } from '@/stores/auth'
import { APP_BUILD, otaLastError } from '@/services/ota'
import { authApi } from '@/api'
import { forgetLastProvider } from '@/services/socialAuth'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const CONFIRM_WORD = '탈퇴'

// 유통기한 알림 설정 (기기 로컬 알림이라 앱에서만 보인다)
const showReminders = remindersSupported()
const reminder = ref(getReminderSettings())

function updateReminder(patch: Partial<typeof reminder.value>) {
  reminder.value = { ...reminder.value, ...patch }
  saveReminderSettings(reminder.value)
  void syncExpiryReminders()
}

onIonViewWillEnter(() => {
  auth.fetchMe()
})

function logout() {
  auth.logout()
  router.replace('/login')
}

async function deleteAccount() {
  const loading = await loadingController.create({ message: '탈퇴 처리 중...' })
  await loading.present()
  try {
    await authApi.deleteAccount()
    forgetLastProvider() // 탈퇴한 계정의 로그인 방식은 더 이상 권하지 않는다.
    auth.logout()
    await router.replace('/login')
    toast.success('탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.')
  } catch (e) {
    toast.error(extractErrorMessage(e, '탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.'))
  } finally {
    await loading.dismiss()
  }
}

// 되돌릴 수 없는 작업이라 확인 단어를 직접 입력하게 한다.
async function confirmDeleteAccount() {
  const alert = await alertController.create({
    header: '회원 탈퇴',
    message: `등록한 집·보관장소·물건·사진이 모두 삭제되며 되돌릴 수 없습니다. 계속하려면 '${CONFIRM_WORD}'를 입력하세요.`,
    inputs: [{ name: 'confirm', placeholder: CONFIRM_WORD }],
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '탈퇴하기',
        role: 'destructive',
        handler: (data) => {
          if (data.confirm?.trim() !== CONFIRM_WORD) {
            toast.error(`'${CONFIRM_WORD}'를 정확히 입력해주세요.`)
            return false
          }
          deleteAccount()
          return true
        },
      },
    ],
  })
  await alert.present()
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
        <ion-item button detail @click="router.push('/places')">
          <ion-icon slot="start" :icon="homeOutline" />
          <ion-label>
            보관 장소 관리
            <p>집 · 보관장소 · 수납공간 추가와 수정</p>
          </ion-label>
        </ion-item>
        <ion-item button @click="router.push('/categories')">
          <ion-icon slot="start" :icon="gridOutline" />
          <ion-label>카테고리 관리</ion-label>
        </ion-item>
        <ion-item button @click="router.push('/tags')">
          <ion-icon slot="start" :icon="pricetagsOutline" />
          <ion-label>태그 관리</ion-label>
        </ion-item>
      </ion-list>

      <ion-list>
        <ion-list-header>
          <ion-label>약관 및 정책</ion-label>
        </ion-list-header>
        <ion-item button detail @click="router.push('/terms')">
          <ion-icon slot="start" :icon="documentTextOutline" />
          <ion-label>서비스 이용약관</ion-label>
        </ion-item>
        <ion-item button detail @click="router.push('/privacy')">
          <ion-icon slot="start" :icon="shieldCheckmarkOutline" />
          <ion-label>개인정보 처리방침</ion-label>
        </ion-item>
      </ion-list>

      <ion-list v-if="showReminders">
        <ion-list-header>
          <ion-label>유통기한 알림</ion-label>
        </ion-list-header>
        <ion-item>
          <ion-icon slot="start" :icon="notificationsOutline" />
          <ion-toggle
            :checked="reminder.enabled"
            @ion-change="updateReminder({ enabled: $event.detail.checked })"
          >
            알림 받기
          </ion-toggle>
        </ion-item>
        <ion-item :disabled="!reminder.enabled">
          <ion-icon slot="start" :icon="timeOutline" />
          <ion-select
            label="알림 시점"
            interface="popover"
            :value="reminder.daysBefore"
            @ion-change="updateReminder({ daysBefore: Number($event.detail.value) })"
          >
            <ion-select-option :value="1">1일 전</ion-select-option>
            <ion-select-option :value="3">3일 전</ion-select-option>
            <ion-select-option :value="7">7일 전</ion-select-option>
            <ion-select-option :value="14">14일 전</ion-select-option>
          </ion-select>
        </ion-item>
        <p class="hint ion-padding-horizontal">만료 {{ reminder.daysBefore }}일 전 오전 {{ REMINDER_HOUR }}시에 알려 드려요.</p>
      </ion-list>

      <div class="ion-padding">
        <ion-button expand="block" fill="outline" color="danger" @click="logout">
          <ion-icon slot="start" :icon="logOutOutline" />
          로그아웃
        </ion-button>
        <ion-button class="delete-account" expand="block" fill="clear" color="medium" size="small" @click="confirmDeleteAccount">
          회원 탈퇴
        </ion-button>
        <!-- 지금 실행 중인 화면 묶음의 버전. 업데이트가 적용됐는지 확인할 때 본다. -->
        <p class="app-build">버전 {{ APP_BUILD }}<template v-if="otaLastError()"><br />업데이트 오류: {{ otaLastError() }}</template></p>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.app-build {
  margin: 12px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--ion-color-medium);
  word-break: break-all;
}
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
.hint {
  color: var(--ion-color-medium);
  font-size: 13px;
  margin: 4px 0 8px;
}
.delete-account {
  margin-top: 24px;
}
</style>
