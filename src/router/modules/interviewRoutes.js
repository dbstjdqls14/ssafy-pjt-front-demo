const interviewRouteDefinitions = [
  {
    path: '/interview/setup',
    name: 'interview-setup',
    component: () => import('../../views/interview/InterviewSetupView.vue'),
    meta: {
      layout: 'default',
      flow: 'interview',
      area: 'practice',
      title: '면접 정보 설정',
      bodyClass: 'practice-flow-page presentation-flow-page interview-flow-page interview-setup-page',
    },
  },
  {
    path: '/interview/style',
    name: 'interview-style',
    component: () => import('../../views/interview/InterviewStyleView.vue'),
    meta: {
      layout: 'default',
      flow: 'interview',
      area: 'practice',
      title: '면접관 선택',
      bodyClass: 'practice-flow-page presentation-flow-page interview-flow-page interview-style-page',
    },
  },
  {
    path: '/interview/questions',
    name: 'interview-questions',
    component: () => import('../../views/interview/InterviewQuestionsView.vue'),
    meta: {
      layout: 'default',
      flow: 'interview',
      area: 'practice',
      title: '면접 질문 관리',
      bodyClass: 'practice-flow-page presentation-flow-page interview-flow-page interview-questions-page',
    },
  },
  {
    path: '/interview/check',
    name: 'interview-check',
    component: () => import('../../views/interview/InterviewCheckView.vue'),
    meta: {
      layout: 'default',
      flow: 'interview',
      area: 'practice',
      title: '면접 카메라·마이크 확인',
      bodyClass:
        'practice-flow-page presentation-flow-page presentation-check-page interview-flow-page interview-check-page',
    },
  },
  {
    path: '/interview/ready',
    name: 'interview-ready',
    component: () => import('../../views/interview/InterviewReadyView.vue'),
    meta: {
      layout: 'default',
      flow: 'interview',
      area: 'practice',
      title: '면접 시작 전 확인',
      bodyClass:
        'practice-flow-page presentation-flow-page presentation-ready-page interview-flow-page interview-ready-page',
    },
  },
  {
    path: '/interview/record',
    name: 'interview-record',
    component: () => import('../../views/interview/InterviewRecordView.vue'),
    meta: {
      layout: 'immersive',
      area: 'practice',
      title: '면접 답변 녹화',
      bodyClass: 'immersive-interview-page',
    },
  },
  {
    path: '/interview/analyzing',
    name: 'interview-analyzing',
    component: () => import('../../views/interview/InterviewAnalyzingView.vue'),
    meta: {
      layout: 'default',
      area: 'practice',
      title: '면접 분석 중',
      bodyClass: 'presentation-analyzing-page interview-analyzing-page',
    },
  },
  {
    path: '/interview/report',
    name: 'interview-report',
    component: () => import('../../views/interview/InterviewReportView.vue'),
    meta: {
      layout: 'default',
      area: 'practice',
      title: '면접 리포트',
      bodyClass: 'presentation-result-page interview-result-page',
    },
  },
  {
    path: '/interview/report/detail',
    name: 'interview-report-detail',
    component: () => import('../../views/interview/InterviewReportDetailView.vue'),
    meta: {
      layout: 'default',
      area: 'archive',
      title: '면접 리포트 상세',
      bodyClass: 'interview-report-page',
    },
  },
]

// 연습 진행·결과 경로는 직접 URL 접근까지 포함해 모두 인증이 필요하다.
export const interviewRoutes = interviewRouteDefinitions.map((route) => ({
  ...route,
  meta: { ...route.meta, requiresAuth: true },
}))
