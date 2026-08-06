export const mypageRoutes = [
  {
    path: '/mypage',
    component: () => import('../../layouts/MyPageLayout.vue'),
    meta: {
      layout: 'default',
      area: 'mypage',
      requiresAuth: true,
    },
    children: [
      {
        path: '',
        name: 'mypage',
        component: () => import('../../views/mypage/MyPageView.vue'),
        meta: {
          title: '마이페이지',
          bodyClass: 'mypage-page mypage-info-page',
        },
      },
      {
        path: 'documents',
        name: 'mypage-documents',
        component: () => import('../../views/mypage/MyPageDocumentsView.vue'),
        meta: {
          title: '자소서/포트폴리오',
          bodyClass: 'mypage-page mypage-documents-page',
        },
      },
      {
        path: 'documents/:id',
        name: 'mypage-document-detail',
        component: () => import('../../views/mypage/MyPageDocumentDetailView.vue'),
        meta: {
          title: '지원 자료 상세',
          bodyClass: 'mypage-page mypage-documents-page',
        },
      },
      {
        path: 'security',
        name: 'mypage-security',
        component: () => import('../../views/mypage/MyPageSecurityView.vue'),
        meta: {
          title: '비밀번호 변경',
          bodyClass: 'mypage-page mypage-security-page',
        },
      },
      {
        path: 'trend',
        name: 'mypage-trend',
        component: () => import('../../views/mypage/MyPageTrendView.vue'),
        meta: {
          title: '내 학습 추이',
          bodyClass: 'mypage-page mypage-trend-page',
        },
      },
    ],
  },
]
