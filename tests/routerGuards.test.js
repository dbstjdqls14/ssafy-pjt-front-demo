import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { installRouterGuards } from '../src/router/guards.js'

describe('router auth guard', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  test('redirects an unauthenticated practice visit with a visible notice reason', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div />' } },
        {
          path: '/practice/folders',
          name: 'folder-select',
          component: { template: '<div />' },
          meta: { requiresAuth: true },
        },
      ],
    })
    installRouterGuards(router)

    await router.push('/practice/folders?type=presentation')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query).toEqual({
      redirect: '/practice/folders?type=presentation',
      notice: 'login-required',
    })
  })

  test('keeps the current body class when a component cancels navigation', () => {
    let afterHook
    const router = {
      beforeEach: vi.fn(),
      afterEach: vi.fn((hook) => { afterHook = hook }),
    }
    installRouterGuards(router)
    document.body.className = 'immersive-record-page'
    document.title = '발표 녹화 - AIVO'

    afterHook(
      { meta: { title: '발표 설정 확인', bodyClass: 'presentation-ready-page' } },
      { meta: { title: '발표 녹화', bodyClass: 'immersive-record-page' } },
      new Error('Navigation aborted'),
    )

    expect(document.body.className).toBe('immersive-record-page')
    expect(document.title).toBe('발표 녹화 - AIVO')
  })
})
