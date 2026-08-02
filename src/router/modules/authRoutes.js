export const authRoutes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../../views/auth/LoginView.vue'),
    meta: {
      layout: 'default',
      area: 'auth',
      title: '로그인',
      bodyClass: 'practice-flow-page practice-type-page auth-page',
    },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../../views/auth/RegisterView.vue'),
    meta: {
      layout: 'default',
      area: 'auth',
      title: '회원가입',
      bodyClass: 'practice-flow-page practice-type-page auth-page',
    },
  },
  {
    path: '/find-account',
    name: 'find-account',
    component: () => import('../../views/auth/FindAccountView.vue'),
    meta: {
      layout: 'default',
      area: 'auth',
      title: '계정 찾기',
      bodyClass: 'practice-flow-page practice-type-page auth-page',
    },
  },
]
