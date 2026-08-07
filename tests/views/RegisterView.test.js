import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, test, vi } from 'vitest'

import { useAuthStore } from '../../src/stores/authStore.js'
import RegisterView from '../../src/views/auth/RegisterView.vue'

const mountView = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', component: RegisterView },
      { path: '/', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
  await router.push('/register')
  await router.isReady()

  return {
    auth: useAuthStore(),
    wrapper: mount(RegisterView, { global: { plugins: [pinia, router] } }),
  }
}

describe('RegisterView validation', () => {
  test('uses a nickname field with explicit limits and sends it as the Spring nickname', async () => {
    const { auth, wrapper } = await mountView()
    auth.register = vi.fn().mockResolvedValue({})

    const username = wrapper.get('#username')
    expect(wrapper.get('label[for="username"]').text()).toBe('닉네임')
    expect(username.attributes('maxlength')).toBeUndefined()

    await username.setValue('재용재용')
    await wrapper.get('#email').setValue('aivo@example.com')
    await wrapper.get('#password').setValue('AivoTest!729')
    await wrapper.get('#password2').setValue('AivoTest!729')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(auth.register).toHaveBeenCalledWith({
      nickname: '재용재용',
      email: 'aivo@example.com',
      password: 'AivoTest!729',
    })
  })

  test('explains which nickname rule is invalid instead of sending a vague request', async () => {
    const { auth, wrapper } = await mountView()
    auth.register = vi.fn()

    await wrapper.get('#username').setValue('닉네임!')
    await wrapper.get('#email').setValue('aivo@example.com')
    await wrapper.get('#password').setValue('AivoTest!729')
    await wrapper.get('#password2').setValue('AivoTest!729')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[data-testid="username-error"]').text()).toContain('한글, 영문, 숫자, 밑줄')
    expect(auth.register).not.toHaveBeenCalled()
  })

  test('keeps an invalid nickname visible and counts it by grapheme until the user fixes it', async () => {
    const { auth, wrapper } = await mountView()
    auth.register = vi.fn()
    const username = wrapper.get('#username')

    await username.setValue('사용자👨‍👩‍👧‍👦')

    expect(username.element.value).toBe('사용자👨‍👩‍👧‍👦')
    expect(wrapper.get('.limited-field .field-counter').text()).toBe('4/20')
    expect(wrapper.get('[data-testid="username-error"]').text()).toContain('한글, 영문, 숫자, 밑줄')

    await username.setValue('사용자_1')
    expect(wrapper.find('[data-testid="username-error"]').exists()).toBe(false)
  })

  test('caps nickname input at 20 visible graphemes', async () => {
    const { wrapper } = await mountView()
    const username = wrapper.get('#username')
    const family = '👨‍👩‍👧‍👦'

    await username.setValue(`${'가'.repeat(19)}${family}나`)

    expect(username.element.value).toBe(`${'가'.repeat(19)}${family}`)
    expect(wrapper.get('.limited-field .field-counter').text()).toBe('20/20')
  })

  test('maps a duplicated nickname response to the nickname field', async () => {
    const { auth, wrapper } = await mountView()
    auth.register = vi.fn().mockRejectedValue({ status: 409, code: '40901' })

    await wrapper.get('#username').setValue('dbswodyd00')
    await wrapper.get('#email').setValue('aivo@example.com')
    await wrapper.get('#password').setValue('AivoTest!729')
    await wrapper.get('#password2').setValue('AivoTest!729')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="username-error"]').text()).toContain('이미 사용 중인 닉네임')
  })

  test('explains the Spring password rule before submitting', async () => {
    const { auth, wrapper } = await mountView()
    auth.register = vi.fn()

    await wrapper.get('#username').setValue('dbswodyd00')
    await wrapper.get('#email').setValue('aivo@example.com')
    await wrapper.get('#password').setValue('abcdefgh')
    await wrapper.get('#password2').setValue('abcdefgh')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('.form-field.field-invalid #password').exists()).toBe(true)
    expect(wrapper.text()).toContain('영문과 숫자')
    expect(auth.register).not.toHaveBeenCalled()
  })
})
