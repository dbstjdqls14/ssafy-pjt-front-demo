import { createRouter, createWebHistory } from 'vue-router'

import { installRouterGuards } from './guards.js'
import { routes } from './routes.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

installRouterGuards(router)

export default router
