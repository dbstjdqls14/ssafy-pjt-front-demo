import { useAuthStore } from '../stores/authStore.js'

export const installRouterGuards = (router) => {
  router.beforeEach((to) => {
    if (to.meta.requiresAuth) {
      const auth = useAuthStore()
      if (!auth.isAuthenticated) {
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    }
    return true
  })

  router.afterEach((to) => {
    if (to.meta.title) document.title = `${to.meta.title} - AIVO`
    if (to.meta.bodyClass !== undefined) {
      document.body.className = to.meta.bodyClass
    }
  })
}
