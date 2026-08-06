// Single source of truth for routing.
//
// Keep this file as a domain-level route registry only. Each module owns the
// lazy-loaded view path and route meta for one bounded area of the app.
// Meta contract:
//   layout       'default' | 'immersive'
//   bodyClass    applied to <body> for CSS scoping
//   area         active header nav key
//   title        document.title
//   requiresAuth guarded by the global beforeEach
//   flow         wizard grouping ('presentation' | 'interview')

import { archiveRoutes } from './modules/archiveRoutes.js'
import { authRoutes } from './modules/authRoutes.js'
import { commonRoutes } from './modules/commonRoutes.js'
import { interviewRoutes } from './modules/interviewRoutes.js'
import { mypageRoutes } from './modules/mypageRoutes.js'
import { practiceRoutes } from './modules/practiceRoutes.js'
import { presentationRoutes } from './modules/presentationRoutes.js'

export const routes = [
  ...commonRoutes,
  ...practiceRoutes,
  ...authRoutes,
  ...mypageRoutes,
  ...presentationRoutes,
  ...interviewRoutes,
  ...archiveRoutes,
]
