export const practiceRoutes = [
  {
    path: '/practice',
    name: 'practice-type',
    component: () => import('../../views/practice/PracticeTypeView.vue'),
    meta: {
      layout: 'default',
      area: 'practice',
      title: '연습 유형 선택',
      bodyClass: 'practice-flow-page practice-type-page',
    },
  },
  {
    path: '/practice/folders',
    name: 'folder-select',
    component: () => import('../../views/practice/FolderSelectView.vue'),
    meta: {
      layout: 'default',
      area: 'practice',
      title: '연습 폴더 선택',
      bodyClass: 'practice-flow-page practice-type-page folder-picker-page',
      requiresAuth: true,
    },
  },
]
