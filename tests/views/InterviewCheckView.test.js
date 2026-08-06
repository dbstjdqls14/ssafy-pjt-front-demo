import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const media = vi.hoisted(() => ({
  stream: null,
  error: null,
  isChecking: null,
  videoTrack: null,
  audioTrack: null,
  videoState: null,
  audioState: null,
  checkDevices: vi.fn(),
  requestVideo: vi.fn(),
  requestAudio: vi.fn(),
  releaseVideo: vi.fn(),
  releaseAudio: vi.fn(),
  refreshPermissionStates: vi.fn(),
  stopStream: vi.fn(),
}))

vi.mock('../../src/composables/useMediaDevices.js', async () => {
  const { ref } = await import('vue')
  media.stream = ref(null)
  media.error = ref(null)
  media.isChecking = ref(false)
  media.videoTrack = ref(null)
  media.audioTrack = ref(null)
  media.videoState = ref('idle')
  media.audioState = ref('idle')
  return {
    INTERVIEW_MEDIA_CONSTRAINTS: { video: true, audio: true },
    useMediaDevices: () => media,
  }
})

vi.mock('../../src/composables/useMicLevel.js', async () => {
  const { ref } = await import('vue')
  return {
    useMicLevel: () => ({
      level: ref(0),
      start: vi.fn(),
      stop: vi.fn(),
    }),
  }
})

import InterviewCheckView from '../../src/views/interview/InterviewCheckView.vue'

const fakeVideoTrack = { kind: 'video', enabled: true, readyState: 'live' }
const fakeAudioTrack = { kind: 'audio', enabled: true, readyState: 'live' }
const streamWith = (...tracks) => ({
  getTracks: () => tracks,
  getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
  getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
})

const mountView = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/interview/check', component: InterviewCheckView },
      { path: '/interview/questions', component: { template: '<div />' } },
      { path: '/interview/ready', component: { template: '<div />' } },
    ],
  })
  await router.push('/interview/check')
  await router.isReady()
  const wrapper = mount(InterviewCheckView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

describe('InterviewCheckView device status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    media.stream.value = null
    media.error.value = null
    media.isChecking.value = false
    media.videoTrack.value = null
    media.audioTrack.value = null
    media.videoState.value = 'idle'
    media.audioState.value = 'idle'
    media.refreshPermissionStates.mockResolvedValue({ video: 'granted', audio: 'granted' })
  })

  test('카메라만 차단되면 마이크 연결 상태는 유지한다', async () => {
    media.checkDevices.mockImplementation(async () => {
      media.stream.value = streamWith(fakeAudioTrack)
      media.videoState.value = 'denied'
      media.audioState.value = 'granted'
      media.audioTrack.value = fakeAudioTrack
      media.error.value = Object.assign(new Error('camera denied'), { name: 'NotAllowedError' })
      throw media.error.value
    })

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="camera-status"]').text()).toContain('권한 필요')
    expect(wrapper.get('[data-testid="microphone-status"]').text()).toContain('입력 정상')
    expect(wrapper.get('.camera-preview-head').text()).toContain('카메라 연결 필요')
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  test('마이크만 차단되면 카메라 연결 상태는 유지한다', async () => {
    media.checkDevices.mockImplementation(async () => {
      media.stream.value = streamWith(fakeVideoTrack)
      media.videoState.value = 'granted'
      media.audioState.value = 'denied'
      media.videoTrack.value = fakeVideoTrack
      media.error.value = Object.assign(new Error('microphone denied'), { name: 'NotAllowedError' })
      throw media.error.value
    })

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="camera-status"]').text()).toContain('연결 정상')
    expect(wrapper.get('[data-testid="microphone-status"]').text()).toContain('권한 필요')
    expect(wrapper.get('.camera-preview-head').text()).toContain('마이크 연결 필요')
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
