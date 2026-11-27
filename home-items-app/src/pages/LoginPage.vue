<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { IonPage, IonContent, IonButton, IonIcon, IonSpinner, IonText } from '@ionic/vue'
import { logoGoogle, chatbubbleEllipses } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { showAlert } from '@/composables/useAlert'
import { PROVIDER_LABEL, SocialAuthError, describeLoginError, getLastProvider, type SocialProvider } from '@/services/socialAuth'
import { tr } from '@/i18n'

const router = useRouter()
const auth = useAuthStore()

// 지난번에 로그인한 방식. 같은 사람이 다른 방식으로 들어가 계정이 둘로 나뉘지 않도록 그 버튼을 강조한다.
const lastProvider = getLastProvider()

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
    const { title, message } = describeLoginError(e)
    await showAlert(title, message)
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="login-wrap">
        <h1 class="title">{{ tr('집안의모든것', 'Home Items') }}</h1>
        <p class="subtitle">{{ tr('우리 집 물건, 어디에 뒀는지 바로 찾기', 'Find where you put things at home, right away') }}</p>

        <p v-if="lastProvider" class="last-hint">
          {{ tr('지난번에 ', 'You signed in with ') }}<strong>{{ PROVIDER_LABEL[lastProvider] }}</strong>{{ tr('로 로그인했어요', ' last time') }}
        </p>

        <div class="providers">
          <div class="provider-wrap" :class="{ recent: lastProvider === 'google' }">
            <span v-if="lastProvider === 'google'" class="recent-badge">{{ tr('최근 사용', 'Last used') }}</span>
            <ion-button
              expand="block"
              class="provider google"
              :disabled="pending !== null"
              @click="signIn('google')"
            >
              <ion-spinner v-if="pending === 'google'" name="crescent" slot="start" />
              <ion-icon v-else :icon="logoGoogle" slot="start" />
              {{ tr(`${PROVIDER_LABEL.google}로 계속하기`, `Continue with ${PROVIDER_LABEL.google}`) }}
            </ion-button>
          </div>

          <div class="provider-wrap" :class="{ recent: lastProvider === 'kakao' }">
            <span v-if="lastProvider === 'kakao'" class="recent-badge">{{ tr('최근 사용', 'Last used') }}</span>
            <ion-button
              expand="block"
              class="provider kakao"
              :disabled="pending !== null"
              @click="signIn('kakao')"
            >
              <ion-spinner v-if="pending === 'kakao'" name="crescent" slot="start" />
              <ion-icon v-else :icon="chatbubbleEllipses" slot="start" />
              {{ tr(`${PROVIDER_LABEL.kakao}로 계속하기`, `Continue with ${PROVIDER_LABEL.kakao}`) }}
            </ion-button>
          </div>
        </div>

        <ion-text color="medium">
          <p class="notice">
            {{ tr('로그인하면 ', 'By signing in, you agree to the ') }}<router-link to="/terms">{{ tr('서비스 이용약관', 'Terms of Service') }}</router-link>{{ tr('과 ', ' and ') }}<router-link to="/privacy">{{ tr('개인정보 처리방침', 'Privacy Policy') }}</router-link>{{ tr('에 동의하는 것으로 봅니다.', '.') }}
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
.last-hint {
  text-align: center;
  font-size: 14px;
  color: var(--ion-color-primary);
  margin: -24px 0 20px;
}
.provider-wrap {
  position: relative;
}
/* 최근 사용한 버튼: 테두리 링으로 눈에 띄게 */
.provider-wrap.recent .provider {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 3px;
  border-radius: 12px;
}
.recent-badge {
  position: absolute;
  top: -10px;
  right: 10px;
  z-index: 2;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  pointer-events: none;
}
.notice a {
  color: inherit;
  text-decoration: underline;
}
.notice {
  margin-top: 28px;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
</style>
