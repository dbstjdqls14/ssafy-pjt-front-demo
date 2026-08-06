import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, test, vi } from 'vitest'

import AppHeader from '../../src/components/common/AppHeader.vue'
import { authApi, userApi } from '../../src/api/index.js'
import { useAuthStore } from '../../src/stores/authStore.js'

describe('AppHeader expiring profile image', () => {
  test('refreshes a failed presigned URL once and renders the renewed URL', async () => {
    localStorage.clear()
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser({ userId: 1, nickname: 'tester', profileImageUrl: 'https://cdn.example.com/expired' })
    vi.spyOn(authApi, 'me').mockResolvedValue({
      userId: 1,
      nickname: 'tester',
      profileImageUrl: 'https://cdn.example.com/renewed',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/practice', component: { template: '<div />' } },
        { path: '/archive', component: { template: '<div />' } },
        { path: '/faq', component: { template: '<div />' } },
        { path: '/mypage', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(AppHeader, { global: { plugins: [pinia, router] } })
    await wrapper.get('[data-testid="nav-profile-image"]').trigger('error')
    await flushPromises()

    expect(authApi.me).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="nav-profile-image"]').attributes('src')).toBe('https://cdn.example.com/renewed')
  })

  test('coalesces concurrent profile refresh requests', async () => {
    localStorage.clear()
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser({ userId: 1, nickname: 'tester', profileImageUrl: 'expired' })
    let resolveMe
    vi.spyOn(authApi, 'me').mockImplementation(() => new Promise((resolve) => { resolveMe = resolve }))

    const first = auth.refreshProfileImage()
    const second = auth.refreshProfileImage()
    expect(authApi.me).toHaveBeenCalledTimes(1)
    resolveMe({ userId: 1, nickname: 'tester', profileImageUrl: 'renewed' })

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ profileImageUrl: 'renewed' }),
      expect.objectContaining({ profileImageUrl: 'renewed' }),
    ])
  })

  test('retries the image when profile data is updated with the same URL', async () => {
    localStorage.clear()
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    const sameUrl = 'https://cdn.example.com/profile.png'
    const profile = { userId: 1, nickname: 'tester', profileImageUrl: sameUrl }
    auth.setUser(profile)
    vi.spyOn(authApi, 'me').mockResolvedValue(profile)
    vi.spyOn(userApi, 'updateProfile').mockResolvedValue(profile)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/practice', component: { template: '<div />' } },
        { path: '/archive', component: { template: '<div />' } },
        { path: '/faq', component: { template: '<div />' } },
        { path: '/mypage', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(AppHeader, { global: { plugins: [pinia, router] } })
    await wrapper.get('[data-testid="nav-profile-image"]').trigger('error')
    await flushPromises()
    expect(wrapper.find('[data-testid="nav-profile-image"]').exists()).toBe(false)

    await auth.updateProfile({ nickname: 'tester' })
    await flushPromises()

    expect(wrapper.get('[data-testid="nav-profile-image"]').attributes('src')).toBe(sameUrl)
  })
})
