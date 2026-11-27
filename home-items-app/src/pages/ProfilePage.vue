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
import { tr, plural } from '@/i18n'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const CONFIRM_WORD = tr('탈퇴', 'DELETE')

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
  const loading = await loadingController.create({ message: tr('탈퇴 처리 중...', 'Deleting account...') })
  await loading.present()
  try {
    await authApi.deleteAccount()
    forgetLastProvider() // 탈퇴한 계정의 로그인 방식은 더 이상 권하지 않는다.
    auth.logout()
    await router.replace('/login')
    toast.success(tr('탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.', 'Your account has been deleted. Thank you for using the app.'))
  } catch (e) {
    toast.error(
      extractErrorMessage(e, tr('탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.', "Couldn't delete your account. Please try again later.")),
    )
  } finally {
    await loading.dismiss()
  }
}

// 되돌릴 수 없는 작업이라 확인 단어를 직접 입력하게 한다.
async function confirmDeleteAccount() {
  const alert = await alertController.create({
    header: tr('회원 탈퇴', 'Delete account'),
    message: tr(
      `등록한 집·보관장소·물건·사진이 모두 삭제되며 되돌릴 수 없습니다. 계속하려면 '${CONFIRM_WORD}'를 입력하세요.`,
      `All your homes, places, items and photos will be deleted and this cannot be undone. Type '${CONFIRM_WORD}' to continue.`,
    ),
    inputs: [{ name: 'confirm', placeholder: CONFIRM_WORD }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('탈퇴하기', 'Delete account'),
        role: 'destructive',
        handler: (data) => {
          if (data.confirm?.trim().toUpperCase() !== CONFIRM_WORD) { // 영어 단어는 대소문자를 가리지 않는다
            toast.error(tr(`'${CONFIRM_WORD}'를 정확히 입력해주세요.`, `Please type '${CONFIRM_WORD}' exactly.`))
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
        <ion-title>{{ tr('내 정보', 'Profile') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="profile ion-padding">
        <div class="avatar">{{ auth.user?.name?.[0] ?? '👤' }}</div>
        <h2>{{ auth.user?.name ?? tr('사용자', 'User') }}</h2>
        <p class="email">{{ auth.user?.email }}</p>
      </div>

      <ion-list>
        <ion-item button detail @click="router.push('/places')">
          <ion-icon slot="start" :icon="homeOutline" />
          <ion-label>
            {{ tr('보관 장소 관리', 'Manage places') }}
            <p>{{ tr('집 · 보관장소 · 수납공간 추가와 수정', 'Add and edit homes, places and storage spots') }}</p>
          </ion-label>
        </ion-item>
        <ion-item button @click="router.push('/categories')">
          <ion-icon slot="start" :icon="gridOutline" />
          <ion-label>{{ tr('카테고리 관리', 'Manage categories') }}</ion-label>
        </ion-item>
        <ion-item button @click="router.push('/tags')">
          <ion-icon slot="start" :icon="pricetagsOutline" />
          <ion-label>{{ tr('태그 관리', 'Manage tags') }}</ion-label>
        </ion-item>
      </ion-list>

      <ion-list>
        <ion-list-header>
          <ion-label>{{ tr('약관 및 정책', 'Terms & policies') }}</ion-label>
        </ion-list-header>
        <ion-item button detail @click="router.push('/terms')">
          <ion-icon slot="start" :icon="documentTextOutline" />
          <ion-label>{{ tr('서비스 이용약관', 'Terms of Service') }}</ion-label>
        </ion-item>
        <ion-item button detail @click="router.push('/privacy')">
          <ion-icon slot="start" :icon="shieldCheckmarkOutline" />
          <ion-label>{{ tr('개인정보 처리방침', 'Privacy Policy') }}</ion-label>
        </ion-item>
      </ion-list>

      <ion-list v-if="showReminders">
        <ion-list-header>
          <ion-label>{{ tr('유통기한 알림', 'Expiry reminders') }}</ion-label>
        </ion-list-header>
        <ion-item>
          <ion-icon slot="start" :icon="notificationsOutline" />
          <ion-toggle
            :checked="reminder.enabled"
            @ion-change="updateReminder({ enabled: $event.detail.checked })"
          >
            {{ tr('알림 받기', 'Get reminders') }}
          </ion-toggle>
        </ion-item>
        <ion-item :disabled="!reminder.enabled">
          <ion-icon slot="start" :icon="timeOutline" />
          <ion-select
            :label="tr('알림 시점', 'Remind me')"
            interface="popover"
            :value="reminder.daysBefore"
            @ion-change="updateReminder({ daysBefore: Number($event.detail.value) })"
          >
            <ion-select-option :value="1">{{ tr('1일 전', '1 day before') }}</ion-select-option>
            <ion-select-option :value="3">{{ tr('3일 전', '3 days before') }}</ion-select-option>
            <ion-select-option :value="7">{{ tr('7일 전', '7 days before') }}</ion-select-option>
            <ion-select-option :value="14">{{ tr('14일 전', '14 days before') }}</ion-select-option>
          </ion-select>
        </ion-item>
        <p class="hint ion-padding-horizontal">
          {{
            tr(
              `만료 ${reminder.daysBefore}일 전 오전 ${REMINDER_HOUR}시에 알려 드려요.`,
              `We'll remind you at ${REMINDER_HOUR} AM, ${plural(reminder.daysBefore, 'day')} before expiry.`,
            )
          }}
        </p>
      </ion-list>

      <div class="ion-padding">
        <ion-button expand="block" fill="outline" color="danger" @click="logout">
          <ion-icon slot="start" :icon="logOutOutline" />
          {{ tr('로그아웃', 'Sign out') }}
        </ion-button>
        <ion-button class="delete-account" expand="block" fill="clear" color="medium" size="small" @click="confirmDeleteAccount">
          {{ tr('회원 탈퇴', 'Delete account') }}
        </ion-button>
        <!-- 지금 실행 중인 화면 묶음의 버전. 업데이트가 적용됐는지 확인할 때 본다. -->
        <p class="app-build">{{ tr('버전', 'Version') }} {{ APP_BUILD }}<template v-if="otaLastError()"><br />{{ tr('업데이트 오류:', 'Update error:') }} {{ otaLastError() }}</template></p>
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
