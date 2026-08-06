import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const face = vi.hoisted(() => ({
  ready: null,
  failed: null,
  prepare: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}))

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

vi.mock('../../src/composables/useFaceAnalysis.js', async () => {
  const { ref } = await import('vue')
  face.ready = ref(false)
  face.failed = ref(false)
  return { useFaceAnalysis: () => face }
})

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

import PresentationCheckView from '../../src/views/presentation/PresentationCheckView.vue'

const fakeStream = {
  getTracks: () => [fakeVideoTrack, fakeAudioTrack],
  getVideoTracks: () => [fakeVideoTrack],
  getAudioTracks: () => [fakeAudioTrack],
}
const fakeVideoTrack = { kind: 'video', enabled: true, readyState: 'live' }
const fakeAudioTrack = { kind: 'audio', enabled: true, readyState: 'live' }

const mountView = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/presentation/check', component: PresentationCheckView },
      { path: '/presentation/slides', component: { template: '<div />' } },
      { path: '/presentation/ready', component: { template: '<div />' } },
    ],
  })
  await router.push('/presentation/check')
  await router.isReady()
  const wrapper = mount(PresentationCheckView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

describe('PresentationCheckView device and model preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    media.stream.value = null
    media.error.value = null
    media.isChecking.value = false
    media.videoTrack.value = null
    media.audioTrack.value = null
    media.videoState.value = 'idle'
    media.audioState.value = 'idle'
    face.ready.value = false
    face.failed.value = false
    face.prepare.mockImplementation(async () => {
      face.ready.value = true
    })
    face.start.mockResolvedValue(undefined)
  })

  test('prepares MediaPipe even when the browser rejects camera and microphone permission', async () => {
    media.checkDevices.mockImplementation(async () => {
      media.error.value = Object.assign(new Error('permission denied'), { name: 'NotAllowedError' })
      throw media.error.value
    })

    const wrapper = await mountView()

    expect(face.prepare).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('READY')
    expect(wrapper.text()).toContain('브라우저 주소창의 카메라와 마이크 권한을 허용해주세요.')
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  test('lets the user request device permission again after the initial request fails', async () => {
    media.checkDevices
      .mockImplementationOnce(async () => {
        media.error.value = Object.assign(new Error('permission denied'), { name: 'NotAllowedError' })
        throw media.error.value
      })
      .mockImplementationOnce(async () => {
        media.error.value = null
        media.stream.value = fakeStream
        media.videoTrack.value = fakeVideoTrack
        media.audioTrack.value = fakeAudioTrack
        media.videoState.value = 'granted'
        media.audioState.value = 'granted'
        return fakeStream
      })

    const wrapper = await mountView()
    await wrapper.get('[data-testid="retry-device-permission"]').trigger('click')
    await flushPromises()

    expect(media.checkDevices).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('장치 연결 정상')
    wrapper.unmount()
  })

  test('마이크 권한만 거부되면 카메라는 연결 상태를 유지한다', async () => {
    media.checkDevices.mockImplementation(async () => {
      media.stream.value = { ...fakeStream, getTracks: () => [fakeVideoTrack], getAudioTracks: () => [] }
      media.videoTrack.value = fakeVideoTrack
      media.videoState.value = 'granted'
      media.audioState.value = 'denied'
      media.error.value = Object.assign(new Error('microphone denied'), { name: 'NotAllowedError' })
      throw media.error.value
    })

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="camera-status"]').text()).toContain('연결 정상')
    expect(wrapper.get('[data-testid="microphone-status"]').text()).toContain('권한 필요')
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  test('카메라 권한만 거부되면 마이크는 연결 상태를 유지한다', async () => {
    media.checkDevices.mockImplementation(async () => {
      media.stream.value = { ...fakeStream, getTracks: () => [fakeAudioTrack], getVideoTracks: () => [] }
      media.audioTrack.value = fakeAudioTrack
      media.audioState.value = 'granted'
      media.videoState.value = 'denied'
      media.error.value = Object.assign(new Error('camera denied'), { name: 'NotAllowedError' })
      throw media.error.value
    })

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="camera-status"]').text()).toContain('권한 필요')
    expect(wrapper.get('[data-testid="microphone-status"]').text()).toContain('입력 정상')
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  test('does not start face sampling on the check screen before presentation recording starts', async () => {
    media.checkDevices.mockImplementation(async () => {
      media.stream.value = fakeStream
      return fakeStream
    })

    const wrapper = await mountView()

    expect(face.prepare).toHaveBeenCalledOnce()
    expect(face.start).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
