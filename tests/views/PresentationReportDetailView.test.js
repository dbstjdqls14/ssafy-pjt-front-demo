import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { presentationApi } from '../../src/api/presentationApi.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import PresentationReportDetailView from '../../src/views/presentation/PresentationReportDetailView.vue'

const report = {
  practice: {
    practiceId: 35,
    title: '서비스 소개 발표',
    practicedAt: '2026-07-20T14:32:00',
    durationSec: 40,
  },
  presentation: { presentationId: 12, slideCount: 2, targetDurationSec: 300 },
  score: {
    overallScore: 91,
    folderAverageScore: 84.3,
    folderAverageDelta: 6.7,
    voiceScore: 93,
    videoScore: 87,
    contentScore: 91,
    questionAnswerScore: 84,
  },
  media: { video: { playbackUrl: 'https://example.com/video.webm' } },
  slides: [
    {
      slideId: 101,
      slideNumber: 1,
      title: '슬라이드 1',
      imageUrl: '/slides/1.png',
      coreContent: '서비스 목적',
      startTimeSec: 0,
      endTimeSec: 20,
      durationSec: 20,
      transcriptSegments: [{ text: '안녕하세요.', startSec: 0, endSec: 2 }],
      speech: {
        averageWpm: 130,
        buckets: [{ startSec: 0, endSec: 10, averageWpm: 130, fillerCount: 0 }],
      },
      gesture: null,
      feedback: { content: '발표 목적을 명확하게 소개했습니다.' },
    },
    {
      slideId: 102,
      slideNumber: 2,
      title: '슬라이드 2',
      imageUrl: '/slides/2.png',
      coreContent: '핵심 기능',
      startTimeSec: 20,
      endTimeSec: 40,
      durationSec: 20,
      transcriptSegments: [],
      speech: null,
      gesture: null,
      feedback: { content: '핵심 기능을 설명했습니다.' },
    },
  ],
  questionAnswers: [{
    questionId: 201,
    question: '차별점은 무엇인가요?',
    userAnswer: '음성과 자세를 함께 분석합니다.',
    feedback: { score: 84, content: '비교 근거를 보완하세요.' },
  }, {
    questionId: 202,
    question: '답변하지 않은 질문입니다.',
    userAnswer: '   ',
    feedback: { score: null, content: '' },
  }],
}

describe('PresentationReportDetailView', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('reloads when the presentation id changes on the reused report route', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = usePresentationStore()
    vi.spyOn(store, 'loadReport').mockImplementation(async (id) => {
      const next = {
        ...report,
        practice: { ...report.practice, title: `report-${id}` },
        presentation: { ...report.presentation, presentationId: id },
      }
      store.report = next
      return next
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/archive/detail', component: PresentationReportDetailView },
        { path: '/archive/folders/:id?', component: { template: '<div />' } },
      ],
    })
    await router.push('/archive/detail?presentationId=12')
    await router.isReady()
    const wrapper = mount(PresentationReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await router.push('/archive/detail?presentationId=13')
    await flushPromises()

    expect(store.loadReport).toHaveBeenNthCalledWith(1, 12)
    expect(store.loadReport).toHaveBeenNthCalledWith(2, 13)
    expect(wrapper.text()).toContain('report-13')
  })

  it('does not let a late response for the previous presentation replace the current report', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = usePresentationStore()
    const resolvers = new Map()
    vi.spyOn(presentationApi, 'getReport').mockImplementation((id) => new Promise((resolve) => {
      resolvers.set(id, resolve)
    }))

    const firstRequest = store.loadReport(12)
    const secondRequest = store.loadReport(13)
    resolvers.get(13)({
      ...report,
      presentation: { ...report.presentation, presentationId: 13 },
    })
    await secondRequest
    resolvers.get(12)({
      ...report,
      presentation: { ...report.presentation, presentationId: 12 },
    })
    await firstRequest

    expect(store.report.presentation.presentationId).toBe(13)
  })

  it('renders the presentation report without transcript highlighting or Q&A seeking', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = usePresentationStore()
    store.report = report
    vi.spyOn(store, 'loadReport').mockResolvedValue(report)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/archive/detail', component: PresentationReportDetailView },
        { path: '/archive/folders/:id?', component: { template: '<div />' } },
      ],
    })
    await router.push('/archive/detail?presentationId=12&folderId=41')
    await router.isReady()

    const wrapper = mount(PresentationReportDetailView, {
      global: { plugins: [pinia, router] },
    })
    await flushPromises()

    expect(store.loadReport).toHaveBeenCalledWith(12)
    expect(wrapper.text()).toContain('서비스 소개 발표')
    expect(wrapper.text()).toContain('93점')
    expect(wrapper.text()).toContain('슬라이드 1')
    expect(wrapper.find('.pr-current-slide').exists()).toBe(false)
    expect(wrapper.get('.pr-transcript').text()).toContain('안녕하세요.')
    expect(wrapper.get('[data-slide-feedback]').text()).toContain('발표 목적을 명확하게 소개했습니다.')
    expect(wrapper.get('[data-slide-feedback]').text()).not.toContain('하이라이트')
    expect(wrapper.get('[data-qna-feedback]').text()).toContain('비교 근거를 보완하세요.')
    expect(wrapper.get('[data-qna-feedback]').text()).not.toContain('답변하지 않은 질문입니다.')
    expect(wrapper.get('[data-qna-feedback]').text()).not.toContain('등록된 답변이 없습니다.')
    expect(wrapper.find('[data-qna-feedback] [data-seek]').exists()).toBe(false)
    expect(wrapper.get('.pr-back').attributes('href')).toBe('/archive/folders/41?type=presentation')
  })

  it('keeps the Q&A section visible when Q&A was enabled but every question was skipped', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = usePresentationStore()
    const skippedReport = {
      ...report,
      presentation: { ...report.presentation, aiQnaEnabled: true },
      questionAnswers: [],
    }
    store.report = skippedReport
    vi.spyOn(store, 'loadReport').mockResolvedValue(skippedReport)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/archive/detail', component: PresentationReportDetailView },
        { path: '/archive/folders/:id?', component: { template: '<div />' } },
      ],
    })
    await router.push('/archive/detail?presentationId=12')
    await router.isReady()

    const wrapper = mount(PresentationReportDetailView, {
      global: { plugins: [pinia, router] },
    })
    await flushPromises()

    expect(wrapper.get('[data-qna-feedback]').text()).toContain(
      '답변한 질문이 없어 질의응답 점수와 피드백이 생성되지 않았습니다.',
    )
    expect(wrapper.find('.pr-qna-list article').exists()).toBe(false)
  })

  it('발화가 없는 슬라이드는 비활성화되고 선택할 수 없다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = usePresentationStore()
    store.report = report
    vi.spyOn(store, 'loadReport').mockResolvedValue(report)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/archive/detail', component: PresentationReportDetailView },
        { path: '/archive/folders/:id?', component: { template: '<div />' } },
      ],
    })
    await router.push('/archive/detail?presentationId=12')
    await router.isReady()

    const wrapper = mount(PresentationReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    // 2번 슬라이드(발화 없음)는 흐리게 표시되고 버튼도 비활성화된다.
    const buttons = wrapper.findAll('.pr-feedback-layout nav button')
    expect(buttons[1].classes()).toContain('is-unmeasured')
    expect(buttons[1].attributes('disabled')).toBeDefined()

    await buttons[1].trigger('click')
    await flushPromises()

    expect(buttons[0].classes()).toContain('is-active')
    expect(buttons[1].classes()).not.toContain('is-active')
    expect(wrapper.find('[data-slide-unmeasured]').exists()).toBe(false)
    const feedback = wrapper.get('[data-slide-feedback]')
    expect(feedback.get('.pr-said-text').text()).toContain('안녕하세요.')
    expect(feedback.get('.pr-feedback-block').text()).toContain('발표 목적을 명확하게 소개했습니다.')
  })

  it('질의응답 피드백에 몇 번 질문인지 표시한다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = usePresentationStore()
    store.report = report
    vi.spyOn(store, 'loadReport').mockResolvedValue(report)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/archive/detail', component: PresentationReportDetailView },
        { path: '/archive/folders/:id?', component: { template: '<div />' } },
      ],
    })
    await router.push('/archive/detail?presentationId=12')
    await router.isReady()

    const wrapper = mount(PresentationReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('[data-qna-feedback] .pr-qna-code').text()).toBe('Q1')
  })
})
