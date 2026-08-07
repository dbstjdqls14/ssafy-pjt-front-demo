import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const media = vi.hoisted(() => ({
  onRequiredDeviceLost: null,
  videoTrack: { kind: 'video', readyState: 'live', stop: vi.fn() },
  audioTrack: { kind: 'audio', readyState: 'live', stop: vi.fn() },
  videoTrackRef: null,
  audioTrackRef: null,
  requestVideo: vi.fn().mockResolvedValue(undefined),
  requestAudio: vi.fn().mockResolvedValue(undefined),
  requestRequiredDevices: vi.fn().mockResolvedValue(undefined),
  releaseVideo: vi.fn(), releaseAudio: vi.fn(), stopStream: vi.fn(),
}))

vi.mock('../../src/composables/useMediaDevices.js', () => ({
  INTERVIEW_MEDIA_CONSTRAINTS: {
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } },
    audio: { echoCancellation: true, noiseSuppression: true },
  },
  useMediaDevices: (options = {}) => {
    media.onRequiredDeviceLost = options.onRequiredDeviceLost
    media.videoTrackRef = ref(media.videoTrack)
    media.audioTrackRef = ref(media.audioTrack)
    const videoPermissionState = ref('granted')
    const audioPermissionState = ref('granted')
    return {
      stream: ref({
        getTracks: () => [media.videoTrack, media.audioTrack],
        getVideoTracks: () => [media.videoTrack],
        getAudioTracks: () => [media.audioTrack],
      }),
      videoTrack: media.videoTrackRef, audioTrack: media.audioTrackRef,
      videoState: ref('granted'), audioState: ref('granted'),
      videoPermissionState, audioPermissionState,
      checkDevices: media.requestRequiredDevices,
      requestRequiredDevices: media.requestRequiredDevices,
      requestVideo: media.requestVideo, requestAudio: media.requestAudio,
      refreshPermissionStates: vi.fn().mockResolvedValue({ video: 'granted', audio: 'granted' }),
      releaseVideo: media.releaseVideo, releaseAudio: media.releaseAudio,
      stopStream: media.stopStream,
    }
  },
}))

const bridge = vi.hoisted(() => ({
  outputStream: { getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] },
  connectVideoTrack: vi.fn().mockResolvedValue(undefined),
  connectAudioTrack: vi.fn().mockResolvedValue(undefined),
  disconnectVideo: vi.fn(), disconnectAudio: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../src/composables/useCaptureBridge.js', () => ({ useCaptureBridge: () => bridge }))

const recorder = vi.hoisted(() => ({
  start: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  stop: vi.fn().mockResolvedValue(new Blob(['video-data'.repeat(200)], { type: 'video/webm' })),
}))
vi.mock('../../src/composables/useRecorder.js', () => ({ useRecorder: () => recorder }))

const speech = vi.hoisted(() => ({
  finalSegments: null, interimText: null, transcript: null,
  start: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn(), reset: vi.fn(),
}))
vi.mock('../../src/composables/useSpeechRecognition.js', async () => {
  const { computed, ref } = await import('vue')
  speech.finalSegments = ref([])
  speech.interimText = ref('')
  speech.transcript = computed(() => [...speech.finalSegments.value, speech.interimText.value].filter(Boolean).join(' '))
  return { useSpeechRecognition: () => speech }
})

vi.mock('../../src/composables/useFaceAnalysis.js', () => ({
  useFaceAnalysis: () => ({
    ready: ref(true), failed: ref(false), faceDetected: ref(false),
    gazeScore: ref(null), tiltScore: ref(null), gazeDeviationCount: ref(0),
    gazeFrontal: ref(null), postureTilted: ref(null),
    prepare: vi.fn().mockResolvedValue(undefined), start: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(), resume: vi.fn().mockResolvedValue(undefined), stop: vi.fn(),
  }),
}))
vi.mock('../../src/composables/useMicLevel.js', () => ({
  useMicLevel: () => ({ level: ref(0), start: vi.fn(), stop: vi.fn() }),
}))
vi.mock('../../src/services/pcmWavCapture.js', () => ({
  PcmWavCapture: class {
    start = vi.fn().mockResolvedValue(undefined)
    stop = vi.fn().mockResolvedValue({ wavBlob: new Blob(['wav-data'.repeat(200)], { type: 'audio/wav' }), chunks: [] })
    pause = vi.fn()
    resume = vi.fn()
  },
}))

import PresentationRecordView from '../../src/views/presentation/PresentationRecordView.vue'
import { usePresentationStore } from '../../src/stores/presentationStore.js'

describe('PresentationRecordView device guard', () => {
  test('presentation camera acquisition uses the same 16:9 constraints as device check', async () => {
    const { wrapper } = await mountView()

    expect(media.requestRequiredDevices).toHaveBeenCalledWith({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    wrapper.unmount()
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    media.onRequiredDeviceLost = null
    media.requestRequiredDevices.mockResolvedValue(undefined)
    localStorage.setItem('aivo.presentation-record-tutorial-seen:guest', 'true')
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  const mountView = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.sessionId = 7
    presentation.practiceId = 11
    presentation.uploadStatus = 'ready'
    presentation.setSlides([{ slideId: 1, slideNumber: 1, imageUrl: '/slide.png' }])
    vi.spyOn(presentation, 'startRecordingSession').mockResolvedValue({ practiceId: 11, firstSlideId: 1 })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/record', component: PresentationRecordView },
        { path: '/presentation/analyzing', component: { template: '<div />' } },
        { path: '/presentation/setup', component: { template: '<div />' } },
        { path: '/practice/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    return { wrapper, router, presentation }
  }

  test('일시정지 중 카메라가 꺼져 있으면 강제로 켜지 않고 재개를 막는다', async () => {
    const { wrapper, router } = await mountView()
    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(1000)
    await flushPromises()
    await wrapper.get('.record-timer-pause').trigger('click')
    vi.advanceTimersByTime(1000)
    await flushPromises()

    const [cameraButton] = wrapper.findAll('.record-media-toggle')
    await cameraButton.trigger('click')
    expect(media.releaseVideo).toHaveBeenCalledTimes(1)
    const requiredDeviceRequestCount = media.requestRequiredDevices.mock.calls.length

    await wrapper.get('.record-timer-pause').trigger('click')
    expect(wrapper.get('.record-resume-modal').text()).toContain('카메라가 꺼져 있습니다')
    expect(wrapper.get('[aria-label="녹화 재개"]').exists()).toBe(true)
    expect(recorder.resume).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="dismiss-presentation-resume-warning"]').trigger('click')
    await flushPromises()
    expect(media.requestRequiredDevices).toHaveBeenCalledTimes(requiredDeviceRequestCount)
    expect(media.requestVideo).not.toHaveBeenCalled()
    expect(recorder.resume).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/presentation/record')

    vi.advanceTimersByTime(1000)
    await flushPromises()
    await wrapper.get('.record-timer-pause').trigger('click')
    expect(wrapper.get('.record-resume-modal').text()).toContain('카메라가 꺼져 있습니다')
    expect(recorder.resume).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/presentation/record')
    wrapper.unmount()
  })

  test('녹화 중 필수 장치를 잃으면 공통 모달을 표시하고 권한 복구 후 자동 재개한다', async () => {
    const { wrapper, router } = await mountView()
    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()
    media.onRequiredDeviceLost({ kind: 'video', reason: 'permission-denied' })
    await flushPromises()

    const permissionModal = wrapper.get('.required-media-permission-dialog')
    expect(permissionModal.text()).toContain('카메라와 마이크 권한이 필요합니다.')
    expect(permissionModal.text()).toContain('주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.')
    expect(permissionModal.findAll('button')).toHaveLength(1)
    expect(permissionModal.text()).not.toContain('발표 종료하기')
    expect(wrapper.get('.record-end-btn').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
    await flushPromises()
    expect(media.requestRequiredDevices).toHaveBeenCalled()
    expect(recorder.resume).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.path).toBe('/presentation/record')
    expect(wrapper.find('.record-start-btn').exists()).toBe(false)
    expect(wrapper.get('[aria-label="일시정지"]').exists()).toBe(true)
    expect(wrapper.find('.required-media-permission-modal').exists()).toBe(false)
    wrapper.unmount()
  })

  test('장치 연결이 실패하면 서버 발표 세션을 먼저 시작하지 않는다', async () => {
    const { wrapper, router, presentation } = await mountView()
    const resetPresentation = vi.spyOn(presentation, 'reset')
    media.videoTrackRef.value = null
    media.audioTrackRef.value = null
    media.requestRequiredDevices.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))

    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()

    expect(presentation.startRecordingSession).not.toHaveBeenCalled()
    expect(wrapper.get('.record-start-btn').exists()).toBe(true)
    expect(wrapper.get('.required-media-permission-dialog').text()).toContain('카메라와 마이크 권한이 필요합니다.')
    expect(wrapper.get('.required-media-permission-dialog').text()).not.toContain('denied')

    media.videoTrackRef.value = media.videoTrack
    media.audioTrackRef.value = media.audioTrack
    await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
    await flushPromises()

    expect(resetPresentation).not.toHaveBeenCalled()
    expect(presentation.startRecordingSession).not.toHaveBeenCalled()
    expect(presentation.sessionId).toBe(7)
    expect(presentation.practiceId).toBe(11)
    expect(router.currentRoute.value.path).toBe('/presentation/record')
    expect(wrapper.find('.required-media-permission-modal').exists()).toBe(false)
    wrapper.unmount()
  })

  test('권한 재요청이 거부되어도 브라우저 원문 대신 사이트 설정 안내를 표시한다', async () => {
    const { wrapper } = await mountView()
    media.videoTrackRef.value = null
    media.audioTrackRef.value = null
    media.requestRequiredDevices.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))

    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()
    media.requestRequiredDevices.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
    await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
    await flushPromises()

    const permissionModal = wrapper.get('.required-media-permission-dialog')
    const modalText = permissionModal.text()
    expect(modalText).toContain('주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.')
    expect(modalText).not.toContain('Permission denied')
    expect(permissionModal.findAll('button')).toHaveLength(1)
    expect(permissionModal.get('button').text()).toBe('확인')
    wrapper.unmount()
  })

  test('이미 일시정지한 발표는 권한을 복구해도 자동 재개하지 않는다', async () => {
    const { wrapper, router } = await mountView()
    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(1000)
    await flushPromises()
    await wrapper.get('.record-timer-pause').trigger('click')
    await flushPromises()
    media.onRequiredDeviceLost({ kind: 'video', reason: 'permission-denied' })
    await flushPromises()

    await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
    await flushPromises()

    expect(recorder.resume).not.toHaveBeenCalled()
    expect(wrapper.get('[aria-label="녹화 재개"]').exists()).toBe(true)
    expect(router.currentRoute.value.path).toBe('/presentation/record')
    wrapper.unmount()
  })

  test('발표 녹화와 10초 WAV 수집은 capture bridge 출력으로 시작한다', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()

    expect(bridge.connectVideoTrack).toHaveBeenCalledWith(media.videoTrack)
    expect(bridge.connectAudioTrack).toHaveBeenCalledWith(media.audioTrack)
    expect(recorder.start).toHaveBeenCalledWith(bridge.outputStream)
    wrapper.unmount()
  })
})
