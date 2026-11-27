import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { IonicVue } from '@ionic/vue'

import App from './App.vue'
import router from './router'
import { startOta } from './services/ota'
import { setupServiceWorker } from './services/serviceWorker'
import { lang, tr } from './i18n'

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

// 화면 언어(기기 언어가 한국어가 아니면 영어)를 문서에도 알린다. 화면 읽기 기능과 브라우저 탭 제목에 쓰인다.
document.documentElement.lang = lang
document.title = tr('집안의모든것', 'Home Items')

const app = createApp(App).use(IonicVue).use(createPinia()).use(router)

// 앱에서는 서비스 워커를 먼저 지운다. 예전 화면이 캐시에서 뜬 경우에는 화면이 다시 뜨므로 여기서 멈춘다.
setupServiceWorker().then(async (reloading) => {
  if (reloading) return
  await router.isReady()
  app.mount('#app')
  // 화면이 뜬 뒤에 정상 실행을 알리고 OTA 업데이트를 확인한다(안드로이드 앱 전용).
  void startOta()
})
