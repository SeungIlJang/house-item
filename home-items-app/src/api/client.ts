// Axios 인스턴스 + 인증 헤더/오류 처리 인터셉터
import axios, { type AxiosInstance } from 'axios'

const TOKEN_KEY = 'home_items_token'

export function getToken(): string | null {
  // 로그인 유지(localStorage) 우선, 아니면 세션(sessionStorage)
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

// persistent=true 면 앱을 껐다 켜도 유지(localStorage), false 면 세션 동안만(sessionStorage)
export function setToken(token: string, persistent = true): void {
  if (persistent) {
    localStorage.setItem(TOKEN_KEY, token)
    sessionStorage.removeItem(TOKEN_KEY)
  } else {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

const client: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 이면 토큰 만료/무효 → 로그인 화면으로 유도
    if (error.response?.status === 401) {
      clearToken()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

// 백엔드 오류 메시지를 뽑아내는 헬퍼
export function extractErrorMessage(error: unknown, fallback = '오류가 발생했습니다.'): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback
  }
  return fallback
}

export default client
