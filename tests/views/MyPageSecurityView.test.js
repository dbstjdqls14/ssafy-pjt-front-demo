import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import MyPageSecurityView from '../../src/views/mypage/MyPageSecurityView.vue'

describe('MyPageSecurityView', () => {
  let pinia

  beforeEach(() => {
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('sends the confirmation password required by the backend contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/mypage/security', component: MyPageSecurityView },
        { path: '/mypage', component: { template: '<div>mypage</div>' } },
      ],
    })
    await router.push('/mypage/security')
    await router.isReady()
    const wrapper = mount(MyPageSecurityView, {
      global: { plugins: [pinia, router] },
    })

    await wrapper.get('#current').setValue('Current123!')
    await wrapper.get('#newPw').setValue('Next12345!')
    await wrapper.get('#confirmPw').setValue('Next12345!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/users/me/password')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({
      currentPassword: 'Current123!',
      newPassword: 'Next12345!',
      newPasswordConfirm: 'Next12345!',
    })
    expect(router.currentRoute.value.fullPath).toBe('/mypage?edit=1')
    wrapper.unmount()
  })
})
