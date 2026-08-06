export const archiveRoutes = [
  {
    path: '/archive',
    name: 'archive',
    component: () => import('../../views/archive/ArchiveView.vue'),
    meta: {
      layout: 'default',
      area: 'archive',
      title: '내 기록',
      bodyClass: 'archive-page practice-flow-page practice-type-page',
      requiresAuth: true,
    },
  },
  {
    path: '/archive/folders/:id?',
    name: 'folder-detail',
    component: () => import('../../views/archive/FolderDetailView.vue'),
    meta: {
      layout: 'default',
      area: 'archive',
      title: '연습 폴더 상세',
      bodyClass: 'folder-detail-page',
      requiresAuth: true,
    },
  },
  {
    path: '/archive/detail/:id?',
    name: 'archive-detail',
    component: () => import('../../views/presentation/PresentationReportDetailView.vue'),
    meta: {
      layout: 'default',
      area: 'archive',
      title: '발표 리포트 상세',
      bodyClass: 'archive-report-page',
      requiresAuth: true,
    },
  },
]
