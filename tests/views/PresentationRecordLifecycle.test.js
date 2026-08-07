import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const face = vi.hoisted(() => ({
  prepare: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  resume: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
}))

const speech = vi.hoisted(() => ({
  finalSegments: { value: [] },
  interimText: { value: '' },
  transcript: { value: '' },
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  reset: vi.fn(),
  stop: vi.fn(),
}))

const mediaTracks = vi.hoisted(() => ({
  audio: { kind: 'audio', readyState: 'live', stop: vi.fn() },
  video: { kind: 'video', readyState: 'live', stop: vi.fn() },
}))

const mediaPermissions = vi.hoisted(() => ({
  audio: 'granted',
  video: 'granted',
}))

const recorder = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}))

vi.mock('../../src/composables/useFaceAnalysis.js', async () => {
  const { ref: vueRef } = await import('vue')
  return {
    useFaceAnalysis: () => ({
      ready: vueRef(true),
      failed: vueRef(false),
      faceDetected: vueRef(false),
      gazeScore: vueRef(null),
      tiltScore: vueRef(null),
      gazeDeviationCount: vueRef(0),
      gazeFrontal: vueRef(null),
      postureTilted: vueRef(null),
      getSessionSummary: () => ({ gazeDeviationCount: 0, gazeEvents: [], tiltBuckets: [] }),
      ...face,
    }),
  }
})

vi.mock('../../src/composables/useMediaDevices.js', () => ({
  INTERVIEW_MEDIA_CONSTRAINTS: { audio: true, video: true },
  useMediaDevices: () => {
    const videoTrack = ref(mediaTracks.video)
    const audioTrack = ref(mediaTracks.audio)
    const videoPermissionState = ref(mediaPermissions.video)
    const audioPermissionState = ref(mediaPermissions.audio)
    const stream = ref({
      getTracks: () => [videoTrack.value, audioTrack.value].filter(Boolean),
      getAudioTracks: () => [audioTrack.value].filter(Boolean),
      getVideoTracks: () => [videoTrack.value].filter(Boolean),
    })
    const requestVideo = vi.fn(async () => {
      if (mediaPermissions.video === 'denied') {
        const error = new Error('Permission denied')
        error.name = 'NotAllowedError'
        throw error
      }
      mediaTracks.video.readyState = 'live'
      videoTrack.value = mediaTracks.video
      videoPermissionState.value = 'granted'
      return mediaTracks.video
    })
    const requestAudio = vi.fn(async () => {
      if (mediaPermissions.audio === 'denied') {
        const error = new Error('Permission denied')
        error.name = 'NotAllowedError'
        throw error
      }
      mediaTracks.audio.readyState = 'live'
      audioTrack.value = mediaTracks.audio
      audioPermissionState.value = 'granted'
      return mediaTracks.audio
    })
    const requestRequiredDevices = vi.fn(async () => {
      await requestVideo()
      await requestAudio()
      return stream.value
    })
    return {
      stream,
      videoTrack,
      audioTrack,
      checkDevices: requestRequiredDevices,
      requestRequiredDevices,
      requestVideo,
      requestAudio,
      videoPermissionState,
      audioPermissionState,
      refreshPermissionStates: vi.fn(async () => {
        videoPermissionState.value = mediaPermissions.video
        audioPermissionState.value = mediaPermissions.audio
        return { video: mediaPermissions.video, audio: mediaPermissions.audio }
      }),
      releaseVideo: vi.fn(() => { mediaTracks.video.stop(); videoTrack.value = null }),
      releaseAudio: vi.fn(() => { mediaTracks.audio.stop(); audioTrack.value = null }),
      stopStream: vi.fn(),
    }
  },
}))

const captureOutput = vi.hoisted(() => ({
  getTracks: () => [],
  getAudioTracks: () => [],
  getVideoTracks: () => [],
}))
vi.mock('../../src/composables/useCaptureBridge.js', () => ({
  useCaptureBridge: () => ({
    outputStream: captureOutput,
    connectVideoTrack: vi.fn().mockResolvedValue(undefined),
    connectAudioTrack: vi.fn().mockResolvedValue(undefined),
    disconnectVideo: vi.fn(),
    disconnectAudio: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('../../src/composables/useRecorder.js', () => ({
  useRecorder: () => recorder,
}))

vi.mock('../../src/composables/useSpeechRecognition.js', async () => {
  const { computed: vueComputed, ref: vueRef } = await import('vue')
  speech.finalSegments = vueRef([])
  speech.interimText = vueRef('')
  speech.transcript = vueComputed(() => (
    [...speech.finalSegments.value, speech.interimText.value].filter(Boolean).join(' ')
  ))
  return { useSpeechRecognition: () => speech }
})

vi.mock('../../src/services/pcmWavCapture.js', () => ({
  PcmWavCapture: class {
    start = vi.fn().mockResolvedValue(undefined)
    stop = vi.fn().mockResolvedValue({ wavBlob: new Blob(['wav'], { type: 'audio/wav' }), chunks: [] })
    pause = vi.fn()
    resume = vi.fn()
  },
}))

import PresentationRecordView from '../../src/views/presentation/PresentationRecordView.vue'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import { useRecordingStore } from '../../src/stores/recordingStore.js'
import {
  consumeRecordingResetNotice,
  markActiveRecording,
  shouldResetRecordingAfterReload,
} from '../../src/utils/recordingRefreshRecovery.js'

describe('PresentationRecordView recording lifecycle', () => {
  let navigationDescriptor

  beforeEach(() => {
    vi.clearAllMocks()
    speech.finalSegments.value = []
    speech.interimText.value = ''
    mediaTracks.audio.readyState = 'live'
    mediaTracks.video.readyState = 'live'
    mediaPermissions.audio = 'granted'
    mediaPermissions.video = 'granted'
    recorder.stop.mockResolvedValue(new Blob(['video'], { type: 'video/webm' }))
    speech.stop.mockImplementation(() => {
      const snapshot = speech.transcript.value
      speech.interimText.value = ''
      return snapshot
    })
    localStorage.setItem('aivo.presentation-record-tutorial-seen:guest', 'true')
    sessionStorage.clear()
    navigationDescriptor = Object.getOwnPropertyDescriptor(performance, 'getEntriesByType')
  })

  test('replaces a completed recording reentry with Home and preserves its report', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    const recording = useRecordingStore()
    const completedReport = {
      presentation: { presentationId: 7, slideCount: 1 },
      score: { overallScore: 42 },
      slides: [],
    }
    presentation.sessionId = 7
    presentation.sessionStatus = 'completed'
    presentation.report = completedReport
    presentation.setSlides([{ slideId: 1, slideNumber: 1, imageUrl: '/slide.png' }])
    recording.start()
    recording.tick()
    recording.addTranscript('이미 종료된 발표 기록')
    markActiveRecording('presentation', 'completed-document')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div data-testid="home-route">home</div>' } },
        { path: '/presentation/record', component: PresentationRecordView },
      ],
    })
    await router.push('/')
    await router.push('/presentation/record')
    await router.isReady()

    const wrapper = mount({
      components: { RouterView },
      template: '<RouterView />',
    }, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.get('[data-testid="home-route"]').text()).toBe('home')
    expect(wrapper.find('.record-shell').exists()).toBe(false)
    expect(presentation.report).toEqual(completedReport)
    expect(presentation.sessionStatus).toBe('completed')
    expect(recording.isRecording).toBe(false)
    expect(recording.elapsedSeconds).toBe(0)
    expect(recording.transcriptSegments).toEqual([])
    expect(consumeRecordingResetNotice()).toEqual({
      kind: 'presentation',
      reason: 'completed-session',
    })
    wrapper.unmount()
  })

  test('prepares MediaPipe on mount but starts sampling only after the start API succeeds', async () => {
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
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()

    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(face.prepare).toHaveBeenCalledOnce()
    expect(face.start).not.toHaveBeenCalled()

    await wrapper.get('button.record-start-btn').trigger('click')
    await flushPromises()

    expect(presentation.startRecordingSession).toHaveBeenCalledOnce()
    expect(face.start).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('aivo.active-recording')).toBe('presentation')
    wrapper.unmount()
  })

  test('shows a busy spinner while the presentation recording is finishing', async () => {
    vi.useFakeTimers()

    let resolveStop
    recorder.stop.mockReturnValue(new Promise((resolve) => {
      resolveStop = resolve
    }))
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
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(1000)
    await flushPromises()
    await wrapper.get('.record-end-btn').trigger('click')

    const finishButton = wrapper.get('.record-end-btn')
    expect(finishButton.attributes('aria-busy')).toBe('true')
    expect(finishButton.attributes('disabled')).toBeDefined()
    expect(finishButton.find('.record-end-spinner').exists()).toBe(true)
    expect(finishButton.text()).toContain('마치는 중')

    resolveStop(new Blob(['video'], { type: 'video/webm' }))
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    wrapper.unmount()
  })
  afterEach(() => {
    vi.useRealTimers()
    if (navigationDescriptor) {
      Object.defineProperty(performance, 'getEntriesByType', navigationDescriptor)
    } else {
      delete performance.getEntriesByType
    }
  })

  test('새로고침으로 다시 열린 진행 중 발표는 폐기하고 메인으로 이동한다', async () => {
    Object.defineProperty(performance, 'getEntriesByType', {
      configurable: true,
      value: vi.fn(() => [{ type: 'reload' }]),
    })
    sessionStorage.setItem('aivo.active-recording', 'presentation')
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.sessionId = 7
    presentation.practiceId = 11
    presentation.uploadStatus = 'ready'
    presentation.setSlides([{ slideId: 1, slideNumber: 1, imageUrl: '/slide.png' }])
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/presentation/record', component: PresentationRecordView },
        { path: '/presentation/analyzing', component: { template: '<div />' } },
        { path: '/presentation/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()

    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(presentation.sessionId).toBeNull()
    expect(presentation.practiceId).toBeNull()
    expect(sessionStorage.getItem('aivo.active-recording')).toBeNull()
    wrapper.unmount()
  })

  test('keeps presentation stopped and shows the existing device-off modal when media was disabled in the UI', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.sessionId = 7
    presentation.practiceId = 11
    presentation.uploadStatus = 'ready'
    presentation.setSlides([{ slideId: 1, slideNumber: 1, imageUrl: '/slide.png' }])
    const startRecordingSession = vi.spyOn(presentation, 'startRecordingSession')
      .mockResolvedValue({ practiceId: 11, firstSlideId: 1 })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/record', component: PresentationRecordView },
        { path: '/presentation/analyzing', component: { template: '<div />' } },
        { path: '/presentation/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await wrapper.get('[aria-label="카메라 끄기"]').trigger('click')
    await wrapper.get('[aria-label="마이크 끄기"]').trigger('click')
    await wrapper.get('button.record-start-btn').trigger('click')
    await flushPromises()

    expect(wrapper.get('.record-resume-modal').text()).toContain('카메라와 마이크가 꺼져 있습니다')
    expect(wrapper.find('.required-media-permission-modal').exists()).toBe(false)
    expect(wrapper.get('button.record-start-btn').exists()).toBe(true)
    expect(startRecordingSession).not.toHaveBeenCalled()
    expect(wrapper.get('[aria-label="카메라 켜기"]').exists()).toBe(true)
    expect(wrapper.get('[aria-label="마이크 켜기"]').exists()).toBe(true)
    wrapper.unmount()
  })

  test('shows the existing permission modal when browser media permission is denied before starting', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.sessionId = 7
    presentation.practiceId = 11
    presentation.uploadStatus = 'ready'
    presentation.setSlides([{ slideId: 1, slideNumber: 1, imageUrl: '/slide.png' }])
    const startRecordingSession = vi.spyOn(presentation, 'startRecordingSession')
      .mockResolvedValue({ practiceId: 11, firstSlideId: 1 })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/record', component: PresentationRecordView },
        { path: '/presentation/analyzing', component: { template: '<div />' } },
        { path: '/presentation/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await wrapper.get('[aria-label="카메라 끄기"]').trigger('click')
    await wrapper.get('[aria-label="마이크 끄기"]').trigger('click')
    mediaPermissions.video = 'denied'
    mediaPermissions.audio = 'denied'
    await wrapper.get('button.record-start-btn').trigger('click')
    await flushPromises()

    expect(wrapper.get('.required-media-permission-modal').text()).toContain('카메라와 마이크 권한이 필요합니다')
    expect(wrapper.find('.record-resume-modal').exists()).toBe(false)
    expect(startRecordingSession).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('locks camera and microphone while recording and requires manual restoration before resuming', async () => {
    vi.useFakeTimers()
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
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await wrapper.get('button.record-start-btn').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(1000)
    await flushPromises()

    expect(wrapper.get('[aria-label="카메라 끄기"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="마이크 끄기"]').attributes('disabled')).toBeDefined()
    expect(mediaTracks.video.readyState).toBe('live')
    expect(mediaTracks.audio.readyState).toBe('live')

    await wrapper.get('[aria-label="일시정지"]').trigger('click')
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(wrapper.get('[aria-label="카메라 끄기"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[aria-label="마이크 끄기"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[aria-label="카메라 끄기"]').trigger('click')
    await wrapper.get('[aria-label="마이크 끄기"]').trigger('click')
    expect(mediaTracks.video.stop).toHaveBeenCalledOnce()
    expect(mediaTracks.audio.stop).toHaveBeenCalledOnce()

    await wrapper.get('[aria-label="녹화 재개"]').trigger('click')
    expect(wrapper.get('.record-resume-modal').exists()).toBe(true)
    await wrapper.get('[data-testid="dismiss-presentation-resume-warning"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="녹화 재개"]').exists()).toBe(true)
    expect(face.pause).toHaveBeenCalled()

    await wrapper.get('[aria-label="카메라 켜기"]').trigger('click')
    await wrapper.get('[aria-label="마이크 켜기"]').trigger('click')
    await flushPromises()
    expect(mediaTracks.video.readyState).toBe('live')
    expect(mediaTracks.audio.readyState).toBe('live')

    vi.advanceTimersByTime(1000)
    await flushPromises()
    await wrapper.get('[aria-label="녹화 재개"]').trigger('click')
    expect(face.resume).toHaveBeenCalled()
    expect(wrapper.get('[aria-label="카메라 끄기"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="마이크 끄기"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  test('keeps slide controls locked until the forward slide event is stored', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.sessionId = 7
    presentation.practiceId = 11
    presentation.uploadStatus = 'ready'
    presentation.setSlides([
      { slideId: 1, slideNumber: 1, imageUrl: '/slide-1.png' },
      { slideId: 2, slideNumber: 2, imageUrl: '/slide-2.png' },
    ])
    vi.spyOn(presentation, 'startRecordingSession').mockResolvedValue({ practiceId: 11, firstSlideId: 1 })
    let resolveTransition
    const recordSlideTransition = vi.spyOn(presentation, 'recordSlideTransition').mockImplementation(() => (
      new Promise((resolve) => { resolveTransition = resolve })
    ))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/record', component: PresentationRecordView },
        { path: '/presentation/analyzing', component: { template: '<div />' } },
        { path: '/presentation/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(1000)
    await flushPromises()

    expect(wrapper.get('[aria-label="이전 슬라이드"]').attributes('disabled')).toBeDefined()
    const next = wrapper.get('[aria-label="다음 슬라이드"]')
    await next.trigger('click')
    await next.trigger('click')
    expect(recordSlideTransition).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.record-nav-counter span').text()).toBe('1 / 2')
    expect(next.attributes('disabled')).toBeDefined()

    resolveTransition(undefined)
    await flushPromises()
    expect(wrapper.get('.record-nav-counter span').text()).toBe('2 / 2')
    wrapper.unmount()
  })

  test('blocks slide navigation while presentation recording is paused', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.sessionId = 7
    presentation.practiceId = 11
    presentation.uploadStatus = 'ready'
    presentation.setSlides([
      { slideId: 1, slideNumber: 1, imageUrl: '/slide-1.png' },
      { slideId: 2, slideNumber: 2, imageUrl: '/slide-2.png' },
    ])
    vi.spyOn(presentation, 'startRecordingSession').mockResolvedValue({ practiceId: 11, firstSlideId: 1 })
    const recordSlideTransition = vi.spyOn(presentation, 'recordSlideTransition').mockResolvedValue(undefined)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/record', component: PresentationRecordView },
        { path: '/presentation/analyzing', component: { template: '<div />' } },
        { path: '/presentation/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await wrapper.get('.record-start-btn').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(1000)
    await flushPromises()
    await wrapper.get('[aria-label="일시정지"]').trigger('click')
    vi.advanceTimersByTime(1000)
    await flushPromises()

    expect(wrapper.get('[aria-label="녹화 재개"]').exists()).toBe(true)
    const nextButton = wrapper.get('[aria-label="다음 슬라이드"]')
    expect(nextButton.attributes('disabled')).toBeDefined()
    await nextButton.trigger('click')
    expect(recordSlideTransition).not.toHaveBeenCalled()
    expect(wrapper.get('.record-nav-counter span').text()).toBe('1 / 2')
    wrapper.unmount()
  })

  test('keeps the final visible interim STT in slide text when recording ends', async () => {
    vi.useFakeTimers()
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
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await wrapper.get('button.record-start-btn').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(1000)
    await flushPromises()
    useRecordingStore().elapsedSeconds = 1
    presentation.slideTimeline = [{
      slideId: 1,
      slideIndex: 0,
      startedAtMs: 0,
      endedAtMs: null,
    }]
    speech.interimText.value = '발표 종료 직전까지 보이던 문장'
    await flushPromises()
    expect(wrapper.text()).toContain('발표 종료 직전까지 보이던 문장')
    await wrapper.get('button.record-end-btn').trigger('click')
    await flushPromises()

    expect(presentation.recordingArtifacts.text).toEqual([
      expect.objectContaining({ page: 1, content: '발표 종료 직전까지 보이던 문장' }),
    ])
    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    expect(shouldResetRecordingAfterReload(
      'presentation',
      { getEntriesByType: () => [{ type: 'reload' }] },
    )).toBe(false)
    wrapper.unmount()
  })

  test('stacks finalized STT sentences bottom-up and keeps the interim line last', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.sessionId = 7
    presentation.practiceId = 11
    presentation.uploadStatus = 'ready'
    presentation.setSlides([{ slideId: 1, slideNumber: 1, imageUrl: '/slide.png' }])
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/record', component: PresentationRecordView },
        { path: '/presentation/analyzing', component: { template: '<div />' } },
        { path: '/presentation/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()
    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })

    speech.finalSegments.value = ['안녕하세요', '감사합니다 안녕하세요 감사합니다', '구']
    speech.interimText.value = '지금 말하는 중'
    await flushPromises()

    const lines = wrapper.findAll('.rail-transcript .transcript-line')
    expect(lines.map((line) => line.text())).toEqual([
      '안녕하세요',
      '감사합니다 안녕하세요 감사합니다',
      '구',
      '지금 말하는 중',
    ])
    // 지나간 문장은 남고, 인식 중인 마지막 줄만 현재 문장으로 강조된다.
    expect(lines.at(-1).classes()).toContain('transcript-line-current')
    expect(lines[0].classes()).toContain('transcript-line-past')
    wrapper.unmount()
  })

  test('blocks route navigation during a presentation and warns that records and report will be lost', async () => {
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

    const wrapper = mount({
      components: { RouterView },
      template: '<RouterView />',
    }, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.get('button.record-start-btn').trigger('click')
    await flushPromises()

    await router.push('/presentation/setup')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/record')
    expect(wrapper.get('.record-exit-modal').text()).toContain('모든 발표 기록이 저장되지 않으며')
    expect(wrapper.get('.record-exit-modal').text()).toContain('리포트도 생성되지 않습니다')

    await wrapper.get('.record-exit-actions button:last-child').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/practice/folders')
    expect(router.currentRoute.value.query.type).toBe('presentation')
    wrapper.unmount()
  })

  test('requests the browser unload warning only after presentation recording starts', async () => {
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
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()

    let beforeUnloadHandler = null
    const nativeAddEventListener = window.addEventListener.bind(window)
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'beforeunload') beforeUnloadHandler = listener
      return nativeAddEventListener(type, listener, options)
    })

    const wrapper = mount(PresentationRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const beforeStart = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(beforeStart)).toBe(true)

    await wrapper.get('button.record-start-btn').trigger('click')
    await flushPromises()

    const afterStart = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(afterStart)).toBe(false)

    const compatibilityEvent = { preventDefault: vi.fn(), returnValue: null }
    beforeUnloadHandler(compatibilityEvent)
    expect(compatibilityEvent.preventDefault).toHaveBeenCalledOnce()
    expect(compatibilityEvent.returnValue).toBe(true)

    wrapper.unmount()
    addEventListenerSpy.mockRestore()
  })
})
