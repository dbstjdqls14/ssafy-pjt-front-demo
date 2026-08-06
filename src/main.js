import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/authStore.js'
import { installInputLengthGuard } from './utils/inputLengthGuard.js'

// Design tokens first, then the shell reset, then the screen style bundle.
import './assets/styles/tokens.css'
import './assets/styles/base.css'
import './assets/styles/index.css'
// Loaded last: normalizes the shared AppHeader across all flows (overrides the
// per-flow header treatments).
import './assets/styles/app-shell.css'

// Single-page shell marker (kept from the previous setup so page-transition and
// shell CSS continue to target the routed viewport rather than the whole body).
document.documentElement.classList.add('aivo-app-shell')

// maxlength가 걸린 모든 입력칸에서 한글 조합 입력이 마지막 글자를 덮어쓰지 않도록
// 상한 도달 시 문자 키를 막는다(화면마다 따로 붙이지 않아도 전역 적용).
installInputLengthGuard()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const auth = useAuthStore(pinia)
if (auth.isAuthenticated) {
  void auth.loadMe().catch(() => null)
}

window.addEventListener('aivo:auth-expired', () => {
  auth.setUser(null)

  const currentRoute = router.currentRoute.value
  if (currentRoute.name !== 'login') {
    router.push({
      name: 'login',
      query: currentRoute.fullPath ? { redirect: currentRoute.fullPath } : undefined,
    })
  }
})

app.mount('#app')

// Reveal the app only after the initial route has resolved (lazy view loaded)
// and one paint frame has passed, so styles and the home motion engine settle
// before <body> becomes visible. This removes the brief flash on reload.
router.isReady().then(() => {
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('aivo-app-booting')
  })
})
