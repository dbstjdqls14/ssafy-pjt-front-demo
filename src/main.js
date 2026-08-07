import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

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

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// Reveal the app only after the initial route has resolved (lazy view loaded)
// and one paint frame has passed, so styles and the home motion engine settle
// before <body> becomes visible. This removes the brief flash on reload.
router.isReady().then(() => {
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('aivo-app-booting')
  })
})
