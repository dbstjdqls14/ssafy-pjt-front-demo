import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const speech = vi.hoisted(() => ({
  transcript: { value: '타임스탬프 없는 전체 답변입니다.' },
  start: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('../../src/composables/useSpeechRecognition.js', () => ({
  useSpeechRecognition: () => speech,
}))

import { presentationApi } from '../../src/api/presentationApi.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import { useRecordingStore } from '../../src/stores/recordingStore.js'
import {
  consumeRecordingResetNotice,
  markActiveRecording,
} from '../../src/utils/recordingRefreshRecovery.js'
import PresentationQnaView from '../../src/views/presentation/PresentationQnaView.vue'

const mountView = async (questions = [{ id: 201, content: 'AIVO의 차별점은 무엇인가요?' }]) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const presentation = usePresentationStore()
  presentation.sessionId = 7
  presentation.audienceQuestions = questions
  markActiveRecording('presentation')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>home</div>' } },
      { path: '/presentation/qna', component: PresentationQnaView },
      { path: '/presentation/analyzing', component: { template: '<div>analyzing</div>' } },
    ],
  })
  await router.push('/presentation/qna')
  await router.isReady()
  const wrapper = mount(PresentationQnaView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router, presentation }
}

describe('PresentationQnaView answer persistence', () => {
  let navigationDescriptor

  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
    navigationDescriptor = Object.getOwnPropertyDescriptor(performance, 'getEntriesByType')
    speech.start.mockReset()
    speech.stop.mockReset()
    speech.reset.mockReset()
    speech.transcript.value = '타임스탬프 없는 전체 답변입니다.'
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    if (navigationDescriptor) {
      Object.defineProperty(performance, 'getEntriesByType', navigationDescriptor)
    } else {
      delete performance.getEntriesByType
    }
  })

  test('advances only after the answer API succeeds', async () => {
    const save = vi.spyOn(presentationApi, 'saveQuestionAnswer').mockResolvedValue('')
    const { wrapper } = await mountView()

    await wrapper.get('.qna-answer-bar button').trigger('click')
    await wrapper.get('.qna-answer-bar button').trigger('click')
    await flushPromises()

    expect(save).toHaveBeenCalledWith(201, '타임스탬프 없는 전체 답변입니다.')
    expect(wrapper.findAll('.qna-answer-log li')).toHaveLength(1)
    expect(wrapper.text()).toContain('모든 질문에 답변했습니다.')
    wrapper.unmount()
  })

  test('keeps the same transcript for retry and prevents duplicate submissions', async () => {
    let rejectFirst
    const save = vi.spyOn(presentationApi, 'saveQuestionAnswer')
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject }))
      .mockResolvedValueOnce('')
    const { wrapper } = await mountView()

    await wrapper.get('.qna-answer-bar button').trigger('click')
    await wrapper.get('.qna-answer-bar button').trigger('click')
    await wrapper.get('.qna-answer-bar button').trigger('click')
    expect(save).toHaveBeenCalledTimes(1)

    rejectFirst(new Error('저장 실패'))
    await flushPromises()
    expect(wrapper.text()).toContain('저장 실패')
    expect(wrapper.text()).toContain('저장 다시 시도')
    expect(wrapper.findAll('.qna-answer-log li')).toHaveLength(0)

    await wrapper.get('.qna-answer-bar button').trigger('click')
    await flushPromises()
    expect(save).toHaveBeenNthCalledWith(2, 201, '타임스탬프 없는 전체 답변입니다.')
    expect(wrapper.findAll('.qna-answer-log li')).toHaveLength(1)
    wrapper.unmount()
  })

  test('captures the visible interim transcript before stopping browser recognition', async () => {
    const save = vi.spyOn(presentationApi, 'saveQuestionAnswer').mockResolvedValue('')
    speech.transcript.value = '아직 final이 아닌 마지막 답변'
    speech.stop.mockImplementation(() => {
      speech.transcript.value = ''
    })
    const { wrapper } = await mountView()

    await wrapper.get('.qna-answer-bar button').trigger('click')
    await wrapper.get('.qna-answer-bar button').trigger('click')
    await flushPromises()

    expect(save).toHaveBeenCalledWith(201, '아직 final이 아닌 마지막 답변')
    wrapper.unmount()
  })

  test('skips only the current question and finishes only from the final button', async () => {
    const save = vi.spyOn(presentationApi, 'saveQuestionAnswer').mockResolvedValue('')
    const { wrapper, router } = await mountView([
      { id: 201, content: '첫 번째 질문입니다.' },
      { id: 202, content: '두 번째 질문입니다.' },
    ])

    expect(wrapper.get('[data-testid="skip-question"]').text()).toBe('현재 질문 건너뛰기')
    await wrapper.get('[data-testid="skip-question"]').trigger('click')
    await flushPromises()

    expect(save).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/presentation/qna')
    expect(wrapper.text()).toContain('첫 번째 질문입니다.')
    expect(wrapper.text()).toContain('두 번째 질문입니다.')
    expect(wrapper.findAll('.qna-question-item')).toHaveLength(2)
    expect(wrapper.findAll('.qna-question-item')[0].classes()).toContain('is-skipped')
    expect(wrapper.get('[data-testid="finish-qna"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="skip-question"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/qna')
    expect(wrapper.text()).toContain('모든 질문을 확인했습니다.')
    expect(wrapper.text()).toContain('질의응답 점수와 피드백이 생성되지 않습니다')
    expect(wrapper.get('[data-testid="finish-qna"]').text()).toBe('피드백 없이 발표 종료')
    expect(wrapper.get('[data-testid="finish-qna"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="finish-qna"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
    expect(router.currentRoute.value.query.phase).toBe('report')
    expect(sessionStorage.getItem('aivo.active-recording')).toBe('presentation')
    wrapper.unmount()
  })

  test('uses only the first three server questions and keeps all three cards mounted', async () => {
    const questions = Array.from({ length: 10 }, (_, index) => ({
      id: 201 + index,
      content: `${index + 1}번째 질문입니다.`,
    }))
    const { wrapper } = await mountView(questions)

    expect(wrapper.findAll('.qna-question-item')).toHaveLength(3)
    expect(wrapper.get('.qna-progress').text()).toBe('0 / 3 답변')
    expect(wrapper.text()).toContain('3번째 질문입니다.')
    expect(wrapper.text()).not.toContain('4번째 질문입니다.')

    await wrapper.get('[data-testid="skip-question"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.qna-question-item')).toHaveLength(3)
    expect(wrapper.findAll('.qna-question-item')[0].classes()).toContain('is-skipped')
    wrapper.unmount()
  })

  test('warns before hard reload only while the Q&A screen is mounted', async () => {
    const { wrapper } = await mountView()

    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false)

    wrapper.unmount()

    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true)
  })

  test('discards presentation and recording state when Q&A mounts after a reload', async () => {
    Object.defineProperty(performance, 'getEntriesByType', {
      configurable: true,
      value: vi.fn(() => [{ type: 'reload' }]),
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    const recording = useRecordingStore()
    presentation.sessionId = 7
    presentation.audienceQuestions = [{ id: 201, content: '질문' }]
    recording.start()
    recording.tick()
    recording.addTranscript('유실될 답변')
    recording.stop(new Blob(['video'], { type: 'video/webm' }))
    markActiveRecording('presentation', 'previous-document')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/presentation/qna', component: PresentationQnaView },
      ],
    })
    await router.push('/presentation/qna')
    await router.isReady()
    const wrapper = mount({
      components: { RouterView },
      template: '<RouterView />',
    }, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(presentation.sessionId).toBeNull()
    expect(recording.isRecording).toBe(false)
    expect(recording.isPaused).toBe(false)
    expect(recording.elapsedSeconds).toBe(0)
    expect(recording.transcriptSegments).toEqual([])
    expect(recording.mediaBlob).toBeNull()
    expect(router.currentRoute.value.path).toBe('/')
    expect(consumeRecordingResetNotice()).toEqual({ kind: 'presentation' })
    wrapper.unmount()
  })
})
