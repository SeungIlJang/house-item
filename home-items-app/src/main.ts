import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { IonicVue } from '@ionic/vue'

import App from './App.vue'
import router from './router'
import { startOta } from './services/ota'

/* Ionic 필수 CSS */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/text-alignment.css'

/* 테마 변수 */
import './theme/variables.css'

const app = createApp(App).use(IonicVue).use(createPinia()).use(router)

router.isReady().then(() => {
  app.mount('#app')
  // 화면이 뜬 뒤에 정상 실행을 알리고 OTA 업데이트를 확인한다(안드로이드 앱 전용).
  void startOta()
})
