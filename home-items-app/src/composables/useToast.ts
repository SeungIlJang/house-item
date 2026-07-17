// 간단한 토스트 알림 composable
import { toastController } from '@ionic/vue'

export function useToast() {
  async function show(message: string, color: 'success' | 'danger' | 'medium' = 'medium') {
    const toast = await toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top',
    })
    await toast.present()
  }
  return {
    success: (m: string) => show(m, 'success'),
    error: (m: string) => show(m, 'danger'),
    info: (m: string) => show(m, 'medium'),
  }
}
