export const commonRoutes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../../views/HomeView.vue'),
    meta: {
      layout: 'immersive',
      area: 'practice',
      title: 'AIVO — 혼자 하는 연습에, 확신을 더하다.',
      bodyClass: 'home-page',
    },
  },
  {
    path: '/faq',
    name: 'faq',
    component: () => import('../../views/FaqView.vue'),
    meta: {
      layout: 'default',
      area: 'faq',
      title: 'FAQ · 이용 안내',
      bodyClass: 'faq-page practice-flow-page practice-type-page',
    },
  },
]
