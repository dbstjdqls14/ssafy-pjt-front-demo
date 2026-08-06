import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { authApi } from '../../src/api/authApi.js'
import { ApiError } from '../../src/api/client.js'
import LoginView from '../../src/views/auth/LoginView.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const mountLogin = async (path = '/login') => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/practice/folders', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return mount(LoginView, { global: { plugins: [pinia, router] } })
}

describe('LoginView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows the auth-required notice after a protected practice redirect', async () => {
    const wrapper = await mountLogin('/login?notice=login-required&redirect=/practice/folders')

    expect(wrapper.text()).toContain('로그인이 필요한 서비스입니다.')
  })

  test('does not expose unsupported social login controls', async () => {
    const wrapper = await mountLogin()

    expect(wrapper.find('.auth-divider').exists()).toBe(false)
    expect(wrapper.find('.social-btn').exists()).toBe(false)
  })

  test('does not expose the unsupported password recovery entry', async () => {
    const wrapper = await mountLogin()

    expect(wrapper.text()).not.toContain('비밀번호 찾기')
    expect(wrapper.find('.auth-help-link').exists()).toBe(false)
  })

  test('maps a missing account 404 to the common credential error', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new ApiError('User Not Found', { status: 404 }))
    const wrapper = await mountLogin()

    await wrapper.find('#email').setValue('missing@example.com')
    await wrapper.find('#password').setValue('wrong-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('이메일 또는 비밀번호를 확인해주세요.')
    expect(wrapper.text()).not.toContain('User Not Found')
  })
})
