import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const permissions = vi.hoisted(() => ({
  states: { video: 'granted', audio: 'granted' },
  query: vi.fn(),
}))

vi.mock('../../src/composables/useMediaDevices.js', () => ({
  queryRequiredMediaPermissions: permissions.query,
}))

import InterviewReadyView from '../../src/views/interview/InterviewReadyView.vue'
import { useInterviewStore } from '../../src/stores/interviewStore.js'

const mountView = async ({ preflightDone = false } = {}) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const interview = useInterviewStore()
  interview.setPreflightDone(preflightDone)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/interview/ready', component: InterviewReadyView },
      { path: '/interview/questions', component: { template: '<div />' } },
      { path: '/interview/record', component: { template: '<div />' } },
    ],
  })
  await router.push('/interview/ready')
  await router.isReady()
  const wrapper = mount(InterviewReadyView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

describe('InterviewReadyView device permission status', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    permissions.states = { video: 'granted', audio: 'granted' }
    permissions.query.mockImplementation(async () => ({ ...permissions.states }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  test('카메라만 차단되면 카메라만 권한 필요로 표시하고 시작을 막는다', async () => {
    permissions.states = { video: 'denied', audio: 'granted' }
    const wrapper = await mountView({ preflightDone: true })

    expect(wrapper.get('[data-testid="ready-camera-status"]').text()).toContain('권한 필요')
    expect(wrapper.get('[data-testid="ready-microphone-status"]').text()).toContain('마이크 정상')
    expect(wrapper.get('.ready-start-button').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  test('마이크만 차단되면 마이크만 권한 필요로 표시하고 시작을 막는다', async () => {
    permissions.states = { video: 'granted', audio: 'denied' }
    const wrapper = await mountView({ preflightDone: true })

    expect(wrapper.get('[data-testid="ready-camera-status"]').text()).toContain('카메라 정상')
    expect(wrapper.get('[data-testid="ready-microphone-status"]').text()).toContain('권한 필요')
    expect(wrapper.get('.ready-start-button').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  test('창으로 돌아오면 변경된 장치 권한을 다시 반영한다', async () => {
    const wrapper = await mountView({ preflightDone: true })
    permissions.states = { video: 'granted', audio: 'denied' }

    window.dispatchEvent(new Event('focus'))
    await flushPromises()

    expect(wrapper.get('[data-testid="ready-camera-status"]').text()).toContain('카메라 정상')
    expect(wrapper.get('[data-testid="ready-microphone-status"]').text()).toContain('권한 필요')
    expect(wrapper.get('.ready-start-button').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
