import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useAuthStore } from '../../src/stores/authStore.js'
import MyPageView from '../../src/views/mypage/MyPageView.vue'

const mountView = async ({ path = '/mypage', loadedUser = null } = {}) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.setUser({
    userId: 1,
    nickname: 'tester_1',
    email: 'jaeyong@example.com',
    profileImageUrl: 'https://cdn.example.com/original.png',
    createdAt: '2026-07-18T09:30:00',
  })
  vi.spyOn(auth, 'loadMe').mockImplementation(async () => {
    if (loadedUser) auth.setUser(loadedUser)
    return auth.user
  })
  const updateProfile = vi.spyOn(auth, 'updateProfile').mockResolvedValue({
    ...auth.user,
    nickname: 'tester_1',
    profileImageUrl: 'https://cdn.example.com/updated.png',
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/mypage', component: MyPageView },
      { path: '/mypage/security', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()

  const wrapper = mount(MyPageView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, auth, updateProfile }
}

const chooseFile = async (wrapper, file) => {
  const input = wrapper.get('[data-testid="profile-image-input"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
}

describe('MyPageView profile image editing', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:profile-preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  test('does not render the former Google account mock blocks', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.text()).not.toContain('Google 계정 연동됨')
    expect(wrapper.text()).toContain('2026.07.18')
    expect(wrapper.text()).not.toContain('2026.07.01')

    await wrapper.get('.mypage-primary-action').trigger('click')
    expect(wrapper.text()).not.toContain('Google 계정 연동됨')
  })

  test('loads the server profile before initializing a direct edit draft', async () => {
    const loadedUser = {
      userId: 1,
      nickname: '서버 닉네임',
      email: 'jaeyong@example.com',
      profileImageUrl: null,
      createdAt: '2026-07-18T09:30:00',
    }

    const { wrapper } = await mountView({ path: '/mypage?edit=1', loadedUser })

    expect(wrapper.get('#nickname').element.value).toBe('서버 닉네임')
    expect(wrapper.get('#nickname').attributes('maxlength')).toBe('20')
  })

  test('exposes long server profile values without allowing them to overflow', async () => {
    const longNickname = 'server_user_name_that_is_already_too_long'
    const longEmail = `${'very-long-address'.repeat(5)}@example.com`
    const { wrapper } = await mountView({
      loadedUser: {
        userId: 1,
        nickname: longNickname,
        email: longEmail,
        createdAt: '2026-07-18T09:30:00',
      },
    })

    expect(wrapper.get('.name-block strong').attributes('title')).toBe(longNickname)
    expect(wrapper.get('.name-block span').attributes('title')).toBe(longEmail)
  })

  test('accepts supported images and displays a local preview', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('.mypage-primary-action').trigger('click')

    const input = wrapper.get('[data-testid="profile-image-input"]')
    expect(input.attributes('accept')).toBe('image/jpeg,image/png,image/webp')
    await chooseFile(wrapper, new File(['image'], 'avatar.webp', { type: 'image/webp' }))

    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="profile-image-preview"]').attributes('src')).toBe('blob:profile-preview')
  })

  test.each([
    [new File(['text'], 'avatar.gif', { type: 'image/gif' }), 'JPEG'],
    [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'avatar.png', { type: 'image/png' }), '5MB'],
  ])('rejects an invalid image before save', async (file, expectedMessage) => {
    const { wrapper, updateProfile } = await mountView()
    await wrapper.get('.mypage-primary-action').trigger('click')
    await chooseFile(wrapper, file)

    expect(wrapper.get('[data-testid="profile-image-error"]').text()).toContain(expectedMessage)
    await wrapper.get('form').trigger('submit')
    expect(updateProfile).not.toHaveBeenCalled()
  })

  test('rejects a nickname with special characters before save', async () => {
    const { wrapper, updateProfile } = await mountView()
    await wrapper.get('.mypage-primary-action').trigger('click')
    await wrapper.get('#nickname').setValue('bad!name')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('.form-field.field-invalid').exists()).toBe(true)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  test('cancel discards a selected preview and restores the server image', async () => {
    const { wrapper, updateProfile } = await mountView()
    await wrapper.get('.mypage-primary-action').trigger('click')
    await chooseFile(wrapper, new File(['image'], 'avatar.png', { type: 'image/png' }))
    await wrapper.get('[data-testid="cancel-profile-edit"]').trigger('click')

    expect(updateProfile).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-preview')
    expect(wrapper.get('[data-testid="profile-image-view"]').attributes('src')).toBe('https://cdn.example.com/original.png')
  })

  test('saves the selected file and can request removal of the current image', async () => {
    const { wrapper, updateProfile } = await mountView()
    await wrapper.get('.mypage-primary-action').trigger('click')
    const image = new File(['image'], 'avatar.jpeg', { type: 'image/jpeg' })
    await chooseFile(wrapper, image)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateProfile).toHaveBeenLastCalledWith({
      nickname: 'tester_1',
      profileImage: image,
      removeProfileImage: false,
    })

    await wrapper.get('.mypage-primary-action').trigger('click')
    await wrapper.get('[data-testid="remove-profile-image"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateProfile).toHaveBeenLastCalledWith({
      nickname: 'tester_1',
      profileImage: null,
      removeProfileImage: true,
    })
  })
})
