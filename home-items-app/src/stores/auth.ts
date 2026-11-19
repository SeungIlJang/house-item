// 인증 상태 전역 스토어. 로그인은 구글·카카오 소셜만 지원한다.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api'
import { clearToken, getToken, setToken } from '@/api/client'
import { signInWith, type SocialProvider } from '@/services/socialAuth'
import { cancelExpiryReminders } from '@/services/expiryReminder'
import type { User } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref<boolean>(!!getToken())

  /** 서버가 발급한 JWT 를 저장하고 내 정보를 불러온다. */
  async function applyToken(token: string): Promise<void> {
    setToken(token, true)
    try {
      await fetchMe()
    } catch (error) {
      logout()
      throw error
    }
  }

  /** 소셜 로그인 시작. 네이티브에서는 토큰을 받아 바로 로그인까지 끝낸다. */
  async function loginWith(provider: SocialProvider): Promise<void> {
    await applyToken(await signInWith(provider))
  }

  async function fetchMe(): Promise<void> {
    if (!getToken()) return
    user.value = await authApi.me()
    isAuthenticated.value = true
  }

  function logout(): void {
    // 다른 계정으로 로그인했을 때 이전 사용자의 물건 알림이 울리지 않도록 지운다.
    void cancelExpiryReminders().catch(() => {})
    clearToken()
    user.value = null
    isAuthenticated.value = false
  }

  return { user, isAuthenticated, applyToken, loginWith, fetchMe, logout }
})
