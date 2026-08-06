import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const speechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}

vi.stubGlobal('SpeechSynthesisUtterance', class {
  constructor(text) { this.text = text }
})
Object.defineProperty(window, 'speechSynthesis', {
  configurable: true,
  value: speechSynthesis,
})

const recognitionInstances = []
class FakeSpeechRecognition {
  constructor() {
    this.start = vi.fn()
    this.stop = vi.fn()
    this.abort = vi.fn()
    this.onresult = null
    this.onend = null
    this.onerror = null
    recognitionInstances.push(this)
  }

  emitFinal(text) {
    const result = [{ transcript: text }]
    result.isFinal = true
    this.onresult?.({ resultIndex: 0, results: [result] })
  }

  end() {
    this.onend?.()
  }
}
Object.defineProperty(window, 'webkitSpeechRecognition', {
  configurable: true,
  value: FakeSpeechRecognition,
})

const media = vi.hoisted(() => ({
  videoTrack: { kind: 'video', readyState: 'live', stop: vi.fn() },
  audioTrack: { kind: 'audio', readyState: 'live', stop: vi.fn() },
  requestVideo: vi.fn(),
  requestAudio: vi.fn(),
  releaseVideo: vi.fn(),
  releaseAudio: vi.fn(),
  stopStream: vi.fn(),
}))

vi.mock('../../src/composables/useMediaDevices.js', () => ({
  INTERVIEW_MEDIA_CONSTRAINTS: { audio: true, video: true },
  getStreamAspectRatio: () => 16 / 9,
  useMediaDevices: () => {
    const videoTrack = ref(media.videoTrack)
    const audioTrack = ref(media.audioTrack)
    return {
      stream: computed(() => ({
        getTracks: () => [videoTrack.value, audioTrack.value].filter(Boolean),
        getVideoTracks: () => [videoTrack.value].filter(Boolean),
        getAudioTracks: () => [audioTrack.value].filter(Boolean),
      })),
      videoTrack,
      audioTrack,
      videoState: ref('granted'),
      audioState: ref('granted'),
      checkDevices: vi.fn().mockResolvedValue(undefined),
      requestRequiredDevices: vi.fn().mockResolvedValue(undefined),
      requestVideo: media.requestVideo,
      requestAudio: media.requestAudio,
      releaseVideo: media.releaseVideo,
      releaseAudio: media.releaseAudio,
      stopStream: media.stopStream,
    }
  },
}))

vi.mock('../../src/composables/useCaptureBridge.js', () => ({
  useCaptureBridge: () => ({
    outputStream: { getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] },
    connectVideoTrack: vi.fn().mockResolvedValue(undefined),
    connectAudioTrack: vi.fn().mockResolvedValue(undefined),
    disconnectVideo: vi.fn(),
    disconnectAudio: vi.fn(),
    setAudioMuted: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  }),
}))

const recorderInstances = vi.hoisted(() => [])
vi.mock('../../src/composables/useRecorder.js', () => ({
  useRecorder: () => {
    const instance = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(new Blob(['recording-data'.repeat(100)], { type: 'video/webm' })),
      pause: vi.fn().mockResolvedValue(true),
      resume: vi.fn().mockResolvedValue(true),
    }
    recorderInstances.push(instance)
    return instance
  },
}))

const faceAnalysis = vi.hoisted(() => ({
  prepare: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  resume: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
}))
vi.mock('../../src/composables/useFaceAnalysis.js', () => ({
  useFaceAnalysis: () => ({
    tiltScore: ref(null),
    gazeDeviationCount: ref(0),
    prepare: faceAnalysis.prepare,
    start: faceAnalysis.start,
    pause: faceAnalysis.pause,
    resume: faceAnalysis.resume,
    stop: faceAnalysis.stop,
    getSessionSummary: () => ({ gazeDeviationCount: 0, gazeEvents: [], tiltBuckets: [] }),
  }),
}))

const pcmCaptureInstances = vi.hoisted(() => [])
vi.mock('../../src/services/pcmWavCapture.js', () => ({
  PcmWavCapture: class {
    constructor() {
      this.start = vi.fn().mockResolvedValue(undefined)
      this.stop = vi.fn().mockResolvedValue({ wavBlob: new Blob(['wav-data'.repeat(200)], { type: 'audio/wav' }), chunks: [] })
      this.flushCurrentChunk = vi.fn().mockResolvedValue(null)
      this.pause = vi.fn()
      this.resume = vi.fn()
      pcmCaptureInstances.push(this)
    }
  },
}))

describe('InterviewRecordView action interlock', () => {
  let InterviewRecordView
  let useInterviewStore
  let navigationDescriptor

  beforeEach(async () => {
    vi.useFakeTimers()
    speechSynthesis.speak.mockReset()
    speechSynthesis.cancel.mockReset()
    recognitionInstances.length = 0
    recorderInstances.length = 0
    pcmCaptureInstances.length = 0
    Object.values(faceAnalysis).forEach((mock) => mock.mockClear())
    localStorage.setItem('aivo.interview-record-tutorial-seen:guest', 'true')
    sessionStorage.clear()
    navigationDescriptor = Object.getOwnPropertyDescriptor(performance, 'getEntriesByType')
    vi.stubGlobal('MediaStream', class {
      constructor(tracks = []) { this.tracks = tracks }
      getTracks() { return this.tracks }
      getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio') }
      getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video') }
    })
    Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
    ;({ default: InterviewRecordView } = await import('../../src/views/interview/InterviewRecordView.vue'))
    ;({ useInterviewStore } = await import('../../src/stores/interviewStore.js'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    if (navigationDescriptor) {
      Object.defineProperty(performance, 'getEntriesByType', navigationDescriptor)
    } else {
      delete performance.getEntriesByType
    }
  })

  const mountView = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    interview.questions = [
      { id: 1, text: '첫 번째 질문입니다.', cat: '공통' },
      { id: 2, text: '두 번째 질문입니다.', cat: '공통' },
    ]
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/record', component: InterviewRecordView },
        { path: '/interview/analyzing', component: { template: '<div />' } },
        { path: '/interview/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/record')
    await router.isReady()
    const wrapper = mount(InterviewRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    return { wrapper, router }
  }

  test('질문 TTS 재생 중에는 다음 질문과 종료를 잠근다', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('aivo.active-recording')).toBe('interview')
    expect(wrapper.get('.ivr-control-primary').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.ivr-question').text()).toContain('첫 번째 질문입니다.')

    await wrapper.get('.ivr-control-primary').trigger('click')
    expect(wrapper.get('.ivr-question').text()).toContain('첫 번째 질문입니다.')

    const utterance = speechSynthesis.speak.mock.calls[0][0]
    utterance.onend()
    await vi.advanceTimersByTimeAsync(1_000)
    await flushPromises()
    expect(wrapper.get('.ivr-control-primary').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  test('TTS를 건너뛰면 같은 캡처 자원을 한 번만 재개하고 바로 답변을 시작한다', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    const questionText = wrapper.get('.ivr-question').text()
    const utterance = speechSynthesis.speak.mock.calls[0][0]
    const cancelCount = speechSynthesis.cancel.mock.calls.length
    const recognition = recognitionInstances[0]

    expect(wrapper.get('.ivr-speaking-skip').text()).toBe('바로 답변하기')
    wrapper.get('.ivr-speaking-skip').element.click()
    wrapper.get('.ivr-speaking-skip').element.click()
    await flushPromises()

    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(cancelCount + 1)
    expect(wrapper.get('.ivr-question').text()).toBe(questionText)
    expect(recorderInstances[0].resume).toHaveBeenCalledTimes(1)
    expect(recorderInstances[1].resume).toHaveBeenCalledTimes(1)
    expect(pcmCaptureInstances[0].resume).toHaveBeenCalledTimes(1)
    expect(faceAnalysis.resume).toHaveBeenCalledTimes(1)
    expect(recognition.start).toHaveBeenCalledTimes(2)
    expect(media.stopStream).not.toHaveBeenCalled()
    expect(faceAnalysis.stop).not.toHaveBeenCalled()
    expect(wrapper.find('.ivr-speaking-skip').exists()).toBe(false)

    utterance.onend()
    await flushPromises()
    expect(recorderInstances[0].resume).toHaveBeenCalledTimes(1)
    expect(faceAnalysis.resume).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(wrapper.get('.ivr-qtimer').text()).toContain('0:59')
    wrapper.unmount()
  })

  test('waits for the current question PCM analysis before opening the next question', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    const firstUtterance = speechSynthesis.speak.mock.calls[0][0]
    firstUtterance.onend()
    await flushPromises()

    let resolveFlush
    pcmCaptureInstances[0].flushCurrentChunk.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFlush = resolve
    }))

    const firstQuestion = wrapper.get('.ivr-question').text()
    await wrapper.get('.ivr-control-primary').trigger('click')
    await flushPromises()
    recognitionInstances[0].end()
    await flushPromises()

    expect(pcmCaptureInstances[0].flushCurrentChunk).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.ivr-question').text()).toBe(firstQuestion)
    expect(wrapper.get('.ivr-control-primary').attributes('disabled')).toBeDefined()

    resolveFlush(null)
    await flushPromises()

    expect(wrapper.get('.ivr-question').text()).not.toBe(firstQuestion)
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  test('late STT events from the closed question cannot enter the next question answer', async () => {
    const { wrapper } = await mountView()
    const interview = useInterviewStore()

    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    speechSynthesis.speak.mock.calls[0][0].onend()
    await flushPromises()

    const firstRecognition = recognitionInstances[0]
    firstRecognition.emitFinal('첫 번째 질문 답변')
    const staleResultHandler = firstRecognition.onresult

    await wrapper.get('.ivr-control-primary').trigger('click')
    await flushPromises()
    firstRecognition.end()
    await flushPromises()

    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2)
    speechSynthesis.speak.mock.calls[1][0].onend()
    await vi.advanceTimersByTimeAsync(1_000)
    await flushPromises()

    const staleResult = [{ transcript: '이전 질문의 늦은 인식 결과' }]
    staleResult.isFinal = true
    staleResultHandler({ resultIndex: 0, results: [staleResult] })

    const secondRecognition = recognitionInstances[1]
    secondRecognition.emitFinal('두 번째 질문 답변')
    await wrapper.get('.ivr-control-primary').trigger('click')
    await flushPromises()
    secondRecognition.end()
    await flushPromises()

    expect(interview.answers).toHaveLength(2)
    expect(interview.answers[0]).toMatchObject({
      questionId: 1,
      questionIndex: 0,
      answer: '첫 번째 질문 답변',
    })
    expect(interview.answers[1]).toMatchObject({
      questionId: 2,
      questionIndex: 1,
      answer: '두 번째 질문 답변',
    })
    wrapper.unmount()
  })

  test('waits until both WebM and audio recorders are paused before speaking TTS, then resumes both', async () => {
    const { wrapper } = await mountView()
    let resolveVideoPause
    recorderInstances[0].pause.mockImplementationOnce(() => new Promise((resolve) => {
      resolveVideoPause = resolve
    }))

    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    expect(recorderInstances[0].pause).toHaveBeenCalled()
    expect(recorderInstances[1].pause).toHaveBeenCalled()
    expect(speechSynthesis.speak).not.toHaveBeenCalled()

    resolveVideoPause(true)
    await flushPromises()
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)

    speechSynthesis.speak.mock.calls[0][0].onend()
    await flushPromises()
    expect(recorderInstances[0].resume).toHaveBeenCalled()
    expect(recorderInstances[1].resume).toHaveBeenCalled()
    wrapper.unmount()
  })

  test('pauses posture and gaze analysis for TTS and resumes it after the question ends', async () => {
    const { wrapper } = await mountView()

    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    expect(faceAnalysis.pause).toHaveBeenCalledTimes(1)
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)
    expect(faceAnalysis.pause.mock.invocationCallOrder[0]).toBeLessThan(
      speechSynthesis.speak.mock.invocationCallOrder[0],
    )
    expect(faceAnalysis.resume).not.toHaveBeenCalled()

    speechSynthesis.speak.mock.calls[0][0].onend()
    await flushPromises()

    expect(faceAnalysis.resume).toHaveBeenCalledTimes(1)
    expect(faceAnalysis.resume.mock.invocationCallOrder[0]).toBeGreaterThan(
      speechSynthesis.speak.mock.invocationCallOrder[0],
    )
    wrapper.unmount()
  })

  test('sends the PCM WAV used by the question clock instead of the legacy audio recorder blob', async () => {
    const { wrapper } = await mountView()
    const interview = useInterviewStore()
    interview.questions = [interview.questions[0]]

    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()
    speechSynthesis.speak.mock.calls[0][0].onend()
    await flushPromises()

    await wrapper.get('.ivr-control-primary').trigger('click')
    await flushPromises()
    recognitionInstances[0].end()
    await flushPromises()
    await flushPromises()

    expect(interview.sessionAudioBlob?.type).toBe('audio/wav')
    expect(interview.sessionAudioBlob?.size).toBeGreaterThan(0)
    wrapper.unmount()
  })

  test('면접 화면에는 별도의 일시정지 버튼을 만들지 않는다', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="interview-pause-toggle"]').exists()).toBe(false)
    wrapper.unmount()
  })

  test('새로고침으로 다시 열린 진행 중 면접은 폐기하고 메인으로 이동한다', async () => {
    Object.defineProperty(performance, 'getEntriesByType', {
      configurable: true,
      value: vi.fn(() => [{ type: 'reload' }]),
    })
    sessionStorage.setItem('aivo.active-recording', 'interview')
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    interview.interviewId = 23
    interview.practiceId = 45
    interview.questions = [{ id: 1, text: '첫 질문', cat: '공통' }]
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/interview/record', component: InterviewRecordView },
        { path: '/interview/analyzing', component: { template: '<div />' } },
        { path: '/interview/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/record')
    await router.isReady()

    const wrapper = mount(InterviewRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(interview.interviewId).toBeNull()
    expect(interview.practiceId).toBeNull()
    expect(sessionStorage.getItem('aivo.active-recording')).toBeNull()
    wrapper.unmount()
  })
})
