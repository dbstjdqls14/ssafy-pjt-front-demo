import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { usePresentationStore } from '../../src/stores/presentationStore.js'
import { useRecordingStore } from '../../src/stores/recordingStore.js'
import {
  consumeRecordingResetNotice,
  markActiveRecording,
} from '../../src/utils/recordingRefreshRecovery.js'
import PresentationAnalyzingView from '../../src/views/presentation/PresentationAnalyzingView.vue'

const createArtifacts = (store) => store.setRecordingArtifacts({
  webmBlob: new Blob(['video'], { type: 'video/webm' }),
  wavBlob: new Blob(['audio'], { type: 'audio/wav' }),
  text: [{ page: 1, timestamp: 0, content: '발표 내용' }],
  nonverbal: { gazeDeviationCount: 0, gazeEvents: [], tiltBuckets: [] },
  durationMs: 12_000,
})

const mountView = async ({ phase = 'complete' } = {}) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>home</div>' } },
      { path: '/presentation/analyzing', component: PresentationAnalyzingView },
      { path: '/presentation/qna', component: { template: '<div>qna</div>' } },
      { path: '/presentation/report', component: { template: '<div>report</div>' } },
    ],
  })
  await router.push({ path: '/presentation/analyzing', query: { phase } })
  await router.isReady()
  const wrapper = mount({
    components: { RouterView },
    template: '<RouterView />',
  }, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('PresentationAnalyzingView', () => {
  let navigationDescriptor

  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.useFakeTimers()
    navigationDescriptor = Object.getOwnPropertyDescriptor(performance, 'getEntriesByType')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    if (navigationDescriptor) {
      Object.defineProperty(performance, 'getEntriesByType', navigationDescriptor)
    } else {
      delete performance.getEntriesByType
    }
  })

  test('sends complete from the analyzing screen and opens the report when Q&A is disabled', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.qnaEnabled = false
    createArtifacts(store)
    const complete = vi.spyOn(store, 'completeSession').mockImplementation(async () => {
      store.sessionStatus = 'completed'
    })
    const loadReport = vi.spyOn(store, 'loadReport').mockResolvedValue({
      score: { overallScore: 91 },
    })
    vi.spyOn(store, 'loadReportJobStatus').mockResolvedValue({ status: 'COMPLETED' })

    const { wrapper, router } = await mountView()

    expect(complete).toHaveBeenCalledWith({ durationMs: 12_000 })
    expect(loadReport).toHaveBeenCalledWith(9)
    expect(router.currentRoute.value.path).toBe('/presentation/report')
    wrapper.unmount()
  })

  test('generates Q&A before complete and waits to complete until Q&A ends', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.qnaEnabled = true
    createArtifacts(store)
    const complete = vi.spyOn(store, 'completeSession')
    const generateQuestions = vi.spyOn(store, 'generateAudienceQuestions').mockResolvedValue([
      { id: 201, content: '질문' },
    ])
    const loadReport = vi.spyOn(store, 'loadReport').mockResolvedValue({})
    markActiveRecording('presentation')

    const { wrapper, router } = await mountView()

    expect(complete).not.toHaveBeenCalled()
    expect(generateQuestions).toHaveBeenCalledOnce()
    expect(loadReport).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/presentation/qna')
    expect(sessionStorage.getItem('aivo.active-recording')).toBe('presentation')
    wrapper.unmount()
  })

  test('completes exactly once after Q&A final end and then polls the report', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.qnaEnabled = true
    createArtifacts(store)
    const complete = vi.spyOn(store, 'completeSession').mockImplementation(async () => {
      store.sessionStatus = 'completed'
    })
    const generateQuestions = vi.spyOn(store, 'generateAudienceQuestions')
    const loadReport = vi.spyOn(store, 'loadReport').mockResolvedValue({
      score: { overallScore: 91 },
    })
    vi.spyOn(store, 'loadReportJobStatus').mockResolvedValue({ status: 'COMPLETED' })

    const { wrapper, router } = await mountView({ phase: 'report' })

    expect(complete).toHaveBeenCalledOnce()
    expect(generateQuestions).not.toHaveBeenCalled()
    expect(loadReport).toHaveBeenCalledWith(9)
    expect(router.currentRoute.value.path).toBe('/presentation/report')
    wrapper.unmount()
  })

  test('polls the report job status and fetches the report only after the report job is COMPLETED', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.sessionStatus = 'completed'
    const loadStatus = vi.spyOn(store, 'loadReportJobStatus')
      .mockResolvedValueOnce({ status: 'STT_ANALYZING' })
      .mockResolvedValueOnce({ status: 'COMPLETED' })
    const loadReport = vi.spyOn(store, 'loadReport').mockResolvedValue({ score: { overallScore: 91 } })

    const { wrapper, router } = await mountView({ phase: 'report' })
    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    expect(wrapper.text()).toContain('발표 음성을 분석하고 있어요')
    expect(loadReport).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(loadStatus).toHaveBeenCalledTimes(2)
    expect(loadReport).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/presentation/report')
    wrapper.unmount()
  })

  test('does not treat the already-completed presentation document status as report readiness', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.sessionStatus = 'completed'
    const loadDocumentStatus = vi.spyOn(store, 'loadProcessingStatus')
      .mockResolvedValue({ processingStatus: 'COMPLETED' })
    vi.spyOn(store, 'loadReportJobStatus').mockResolvedValue({
      presentationId: 9,
      practiceId: 21,
      audioId: 31,
      requestId: 'job-1',
      status: 'PENDING',
      errorMessage: null,
      createdAt: '2026-08-07T00:00:00',
      updatedAt: '2026-08-07T00:00:00',
    })
    const loadReport = vi.spyOn(store, 'loadReport').mockResolvedValue({ score: { overallScore: 91 } })

    const { wrapper, router } = await mountView({ phase: 'report' })

    expect(loadDocumentStatus).not.toHaveBeenCalled()
    expect(loadReport).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    expect(wrapper.text()).toContain('발표 분석 순서를 기다리고 있어요')
    wrapper.unmount()
  })

  test('shows guidance without offering a misleading reanalysis action when complete fails', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.qnaEnabled = false
    const artifacts = createArtifacts(store)
    const complete = vi.spyOn(store, 'completeSession')
      .mockRejectedValueOnce(new Error('업로드 실패'))
      .mockImplementationOnce(async () => {
        store.sessionStatus = 'completed'
      })
    vi.spyOn(store, 'loadReport').mockResolvedValue({ score: { overallScore: 80 } })
    vi.spyOn(store, 'loadReportJobStatus').mockResolvedValue({ status: 'COMPLETED' })

    const { wrapper, router } = await mountView()
    expect(wrapper.get('[role="alert"]').text()).toContain('업로드 실패')
    expect(store.recordingArtifacts.webm).toBe(artifacts.webm)
    expect(store.recordingArtifacts.wav).toBe(artifacts.wav)

    expect(wrapper.text()).toContain('새 연습을 시작해 다시 시도해주세요.')
    expect(wrapper.text()).not.toContain('다시 분석하기')
    expect(wrapper.find('[data-testid="retry-presentation-analysis"]').exists()).toBe(false)
    expect(complete).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    wrapper.unmount()
  })

  test('keeps one notice card and changes its copy after server acceptance', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.sessionStatus = 'completed'
    let resolveStatus
    vi.spyOn(store, 'loadReportJobStatus').mockReturnValue(new Promise((resolve) => {
      resolveStatus = resolve
    }))
    markActiveRecording('presentation')

    const { wrapper } = await mountView({ phase: 'report' })
    const notice = wrapper.get('[data-testid="presentation-analysis-notice"]')

    expect(notice.text()).toContain('녹화 파일을 업로드하고 있어요')
    expect(notice.text()).toContain('아직 서버에 안전하게 저장되지 않았어요')

    resolveStatus({ status: 'STT_ANALYZING' })
    await flushPromises()

    expect(wrapper.get('[data-testid="presentation-analysis-notice"]').element).toBe(notice.element)
    expect(wrapper.get('[data-testid="presentation-analysis-notice"]').text())
      .toContain('분석 결과를 준비하고 있어요')
    expect(wrapper.get('[data-testid="presentation-analysis-notice"]').text())
      .toContain('페이지를 이동해도 분석은 계속되며, 완료 후 내 기록에서 확인할 수 있습니다.')
    expect(sessionStorage.getItem('aivo.active-recording')).toBeNull()
    wrapper.unmount()
  })

  test('discards a reloaded question-generation session before analysis resumes', async () => {
    Object.defineProperty(performance, 'getEntriesByType', {
      configurable: true,
      value: vi.fn(() => [{ type: 'reload' }]),
    })
    const store = usePresentationStore()
    const recording = useRecordingStore()
    store.sessionId = 9
    store.qnaEnabled = true
    createArtifacts(store)
    recording.start()
    recording.tick()
    recording.addTranscript('유실될 발표 내용')
    recording.stop(new Blob(['video'], { type: 'video/webm' }))
    markActiveRecording('presentation', 'previous-document')
    const generateQuestions = vi.spyOn(store, 'generateAudienceQuestions')

    const { wrapper, router } = await mountView()

    expect(generateQuestions).not.toHaveBeenCalled()
    expect(store.sessionId).toBeNull()
    expect(recording.isRecording).toBe(false)
    expect(recording.isPaused).toBe(false)
    expect(recording.elapsedSeconds).toBe(0)
    expect(recording.transcriptSegments).toEqual([])
    expect(recording.mediaBlob).toBeNull()
    expect(router.currentRoute.value.path).toBe('/')
    expect(consumeRecordingResetNotice()).toEqual({ kind: 'presentation' })
    wrapper.unmount()
  })

  test('allows leaving without another warning after background report polling starts', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.sessionStatus = 'completed'
    vi.spyOn(store, 'loadReportJobStatus').mockResolvedValue({ status: 'STT_ANALYZING' })

    const { wrapper, router } = await mountView({ phase: 'report' })

    await router.push('/presentation/qna')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/qna')
    expect(wrapper.find('[data-testid="presentation-analysis-exit-dialog"]').exists()).toBe(false)

    const unload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(unload)).toBe(true)
    wrapper.unmount()
  })

  test('keeps upload copy and exit guards until the first accepted status arrives', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.sessionStatus = 'completed'
    vi.spyOn(store, 'loadReportJobStatus').mockReturnValue(new Promise(() => {}))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/analyzing', component: PresentationAnalyzingView },
        { path: '/presentation/qna', component: { template: '<div>qna</div>' } },
      ],
    })
    await router.push({ path: '/presentation/analyzing', query: { phase: 'report' } })
    await router.isReady()
    const wrapper = mount({
      components: { RouterView },
      template: '<RouterView />',
    }, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="presentation-analysis-notice"]').text())
      .toContain('녹화 파일을 업로드하고 있어요')
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false)

    await router.push('/presentation/qna')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    expect(wrapper.get('[data-testid="presentation-analysis-exit-dialog"]').text())
      .toContain('아직 파일 업로드가 끝나지 않았어요')
    wrapper.unmount()
  })

  test('discards client-only presentation data when the user forces an unsafe exit', async () => {
    const store = usePresentationStore()
    const recording = useRecordingStore()
    store.sessionId = 9
    store.sessionStatus = 'completed'
    createArtifacts(store)
    recording.start()
    recording.tick()
    recording.addTranscript('유실될 발표 내용')
    recording.stop(new Blob(['video'], { type: 'video/webm' }))
    markActiveRecording('presentation')
    vi.spyOn(store, 'loadReportJobStatus').mockReturnValue(new Promise(() => {}))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/analyzing', component: PresentationAnalyzingView },
        { path: '/presentation/qna', component: { template: '<div>qna</div>' } },
      ],
    })
    await router.push({ path: '/presentation/analyzing', query: { phase: 'report' } })
    await router.isReady()
    const wrapper = mount({
      components: { RouterView },
      template: '<RouterView />',
    }, { global: { plugins: [router] } })
    await flushPromises()

    await router.push('/presentation/qna')
    await flushPromises()
    await wrapper.get('.analysis-exit-actions .is-danger').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/qna')
    expect(store.sessionId).toBeNull()
    expect(recording.elapsedSeconds).toBe(0)
    expect(recording.transcriptSegments).toEqual([])
    expect(recording.mediaBlob).toBeNull()
    expect(sessionStorage.getItem('aivo.active-recording')).toBeNull()
    wrapper.unmount()
  })

  test('continues the pending navigation when PENDING arrives with the exit modal open', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.sessionStatus = 'completed'
    let resolveStatus
    vi.spyOn(store, 'loadReportJobStatus').mockReturnValue(new Promise((resolve) => {
      resolveStatus = resolve
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/analyzing', component: PresentationAnalyzingView },
        { path: '/presentation/qna', component: { template: '<div>qna</div>' } },
      ],
    })
    await router.push({ path: '/presentation/analyzing', query: { phase: 'report' } })
    await router.isReady()
    const wrapper = mount({
      components: { RouterView },
      template: '<RouterView />',
    }, { global: { plugins: [router] } })
    await flushPromises()

    await router.push('/presentation/qna')
    await flushPromises()
    expect(wrapper.find('[data-testid="presentation-analysis-exit-dialog"]').exists()).toBe(true)

    resolveStatus({ status: 'PENDING' })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/qna')
    wrapper.unmount()
  })

  test('blocks route and browser exits while analysis is running', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.qnaEnabled = false
    createArtifacts(store)
    vi.spyOn(store, 'completeSession').mockReturnValue(new Promise(() => {}))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/analyzing', component: PresentationAnalyzingView },
        { path: '/presentation/setup', component: { template: '<div>setup</div>' } },
      ],
    })
    await router.push('/presentation/analyzing')
    await router.isReady()
    const wrapper = mount({
      components: { RouterView },
      template: '<RouterView />',
    }, { global: { plugins: [router] } })
    await flushPromises()

    await router.push('/presentation/setup')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    expect(wrapper.get('[data-testid="presentation-analysis-exit-dialog"]').text())
      .toContain('아직 파일 업로드가 끝나지 않았어요')

    const unload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(unload)).toBe(false)

    await wrapper.get('[data-testid="continue-presentation-analysis"]').trigger('click')
    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    wrapper.unmount()
  })
})
