// 인증 상태 전역 스토어 (토큰/사용자)
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api'
import { clearToken, getToken, setToken } from '@/api/client'
import type { User } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref<boolean>(!!getToken())

  async function login(email: string, password: string): Promise<void> {
    const data = await authApi.login(email, password)
    setToken(data.accessToken)
    user.value = data.user
    isAuthenticated.value = true
  }

  async function signup(email: string, password: string, name: string): Promise<void> {
    await authApi.signup(email, password, name)
    await login(email, password)
  }

  async function fetchMe(): Promise<void> {
    if (!getToken()) return
    user.value = await authApi.me()
    isAuthenticated.value = true
  }

  function logout(): void {
    clearToken()
    user.value = null
    isAuthenticated.value = false
  }

  return { user, isAuthenticated, login, signup, fetchMe, logout }
})
