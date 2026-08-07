import { useAuthStore } from '../stores/authStore.js'

export const installRouterGuards = (router) => {
  router.beforeEach((to) => {
    if (to.meta.requiresAuth) {
      const auth = useAuthStore()
      if (!auth.isAuthenticated) {
        return {
          name: 'login',
          query: { redirect: to.fullPath, notice: 'login-required' },
        }
      }
    }
    return true
  })

  router.afterEach((to, _from, failure) => {
    // Vue Router also calls afterEach for aborted/cancelled navigations.
    // Applying the destination body class in that case leaves the current
    // component mounted with another page's layout styles.
    if (failure) return
    if (to.meta.title) document.title = `${to.meta.title} - AIVO`
    if (to.meta.bodyClass !== undefined) {
      document.body.className = to.meta.bodyClass
    }
  })
}
