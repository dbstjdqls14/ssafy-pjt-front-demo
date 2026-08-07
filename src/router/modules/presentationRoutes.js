const presentationRouteDefinitions = [
  {
    path: '/presentation/setup',
    name: 'presentation-setup',
    component: () => import('../../views/presentation/PresentationSetupView.vue'),
    meta: {
      layout: 'default',
      flow: 'presentation',
      area: 'practice',
      title: '발표 설정',
      bodyClass: 'practice-flow-page presentation-flow-page presentation-setup-page',
    },
  },
  {
    path: '/presentation/slides',
    name: 'presentation-slides',
    component: () => import('../../views/presentation/PresentationSlidesView.vue'),
    meta: {
      layout: 'default',
      flow: 'presentation',
      area: 'practice',
      title: '발표 슬라이드 설정',
      bodyClass: 'practice-flow-page presentation-flow-page presentation-slides-page',
    },
  },
  {
    path: '/presentation/check',
    name: 'presentation-check',
    component: () => import('../../views/presentation/PresentationCheckView.vue'),
    meta: {
      layout: 'default',
      flow: 'presentation',
      area: 'practice',
      title: '발표 카메라·마이크 확인',
      bodyClass: 'practice-flow-page presentation-flow-page presentation-check-page',
    },
  },
  {
    path: '/presentation/ready',
    name: 'presentation-ready',
    component: () => import('../../views/presentation/PresentationReadyView.vue'),
    meta: {
      layout: 'default',
      flow: 'presentation',
      area: 'practice',
      title: '발표 설정 확인',
      bodyClass: 'practice-flow-page presentation-flow-page presentation-ready-page',
    },
  },
  {
    path: '/presentation/record',
    name: 'presentation-record',
    component: () => import('../../views/presentation/PresentationRecordView.vue'),
    meta: {
      layout: 'immersive',
      area: 'practice',
      title: '발표 녹화',
      bodyClass: 'immersive-record-page',
    },
  },
  {
    path: '/presentation/qna',
    name: 'presentation-qna',
    component: () => import('../../views/presentation/PresentationQnaView.vue'),
    meta: {
      layout: 'default',
      area: 'practice',
      title: '청중 질문',
      bodyClass: 'presentation-qna-page',
    },
  },
  {
    path: '/presentation/analyzing',
    name: 'presentation-analyzing',
    component: () => import('../../views/presentation/PresentationAnalyzingView.vue'),
    meta: {
      layout: 'default',
      area: 'practice',
      title: '발표 분석 중',
      bodyClass: 'presentation-analyzing-page presentation-report-analyzing-page',
    },
  },
  {
    path: '/presentation/report',
    name: 'presentation-report',
    component: () => import('../../views/presentation/PresentationReportView.vue'),
    meta: {
      layout: 'default',
      area: 'practice',
      title: '발표 리포트',
      bodyClass: 'presentation-result-page',
    },
  },
]

// 연습 진행·결과 경로는 직접 URL 접근까지 포함해 모두 인증이 필요하다.
export const presentationRoutes = presentationRouteDefinitions.map((route) => ({
  ...route,
  meta: { ...route.meta, requiresAuth: true },
}))
