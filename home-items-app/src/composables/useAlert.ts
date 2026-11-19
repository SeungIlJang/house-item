// 확인 버튼 하나짜리 팝업. 토스트(2초 후 사라짐)와 달리 사용자가 닫을 때까지 남아 있어
// 오류 원인을 놓치지 않는다.
import { alertController } from '@ionic/vue'

export async function showAlert(title: string, message: string): Promise<void> {
  const alert = await alertController.create({
    header: title,
    message,
    // 메시지의 줄바꿈을 그대로 보여 준다(theme/variables.css 의 .alert-pre-line).
    cssClass: 'alert-pre-line',
    buttons: ['확인'],
  })
  await alert.present()
  await alert.onDidDismiss()
}
