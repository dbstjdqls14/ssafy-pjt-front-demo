import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { interviewApi } from '../../src/api/interviewApi.js'
import { useInterviewStore } from '../../src/stores/interviewStore.js'
import InterviewReportDetailView from '../../src/views/interview/InterviewReportDetailView.vue'

describe('InterviewReportDetailView real report fields', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('loads the report selected in the route even when another report is cached', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail?id=47')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = { interviewId: 21, title: '이전 면접', questionEvaluations: [] }
    vi.spyOn(interviewApi, 'getReport').mockResolvedValue({
      interviewId: 47,
      title: '선택한 면접',
      questionEvaluations: [],
    })

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('선택한 면접')
    expect(interview.report.interviewId).toBe(47)
  })

  it('reloads the report when the selected interview id changes on the same route', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail?id=47')
    await router.isReady()

    vi.spyOn(interviewApi, 'getReport').mockImplementation(async (id) => ({
      interviewId: Number(id),
      title: `${id}번 면접`,
      questionEvaluations: [],
    }))
    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await router.push('/interview/report/detail?id=48')
    await flushPromises()

    expect(wrapper.text()).toContain('48번 면접')
    expect(useInterviewStore().report.interviewId).toBe(48)
  })

  it('renders the summary, expands detailed feedback, and uses index-based evidence without demo fallbacks', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const answer = '저는 응답 시간을 30% 줄였습니다.'
    const evidenceText = '응답 시간을 30% 줄였습니다'
    const interview = useInterviewStore()
    interview.report = {
      interviewId: 21,
      title: '삼성전자 백엔드 면접',
      description: '2026 상반기 백엔드 직무 대비',
      durationSeconds: 40,
      overallScore: 88,
      metrics: { voiceScore: 86, videoScore: 82, contentScore: 91 },
      scoreCards: [],
      contentEvaluation: {
        relevanceScore: 90,
        structureScore: 85,
        clarityScore: 88,
        deliveryScore: 86,
        summary: '답변 구조가 명확합니다.',
      },
      strengths: ['정량적인 성과를 제시했습니다.'],
      improvements: ['협업 과정을 더 설명해보세요.'],
      detailedFeedback: '전반적으로 근거가 분명한 답변입니다.',
      questionEvaluations: [{
        questionId: 'q-1',
        question: '성과를 설명해주세요.',
        answer,
        score: 89,
        durationSeconds: 40,
        evidence: [{
          type: 'strength',
          text: evidenceText,
          startIndex: answer.indexOf(evidenceText),
          endIndex: answer.indexOf(evidenceText) + evidenceText.length,
          reason: '정량적 성과를 제시한 부분입니다.',
        }],
      }],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('2026 상반기 백엔드 직무 대비')
    expect(wrapper.findAll('.archive-report-meta dd')[0].text()).toMatch(/^\d{4}\.\d{2}\.\d{2}$/)
    expect(wrapper.text()).toContain('답변 구조가 명확합니다.')
    expect(wrapper.find('#overallFeedbackDetails').isVisible()).toBe(false)
    await wrapper.get('.iv-overall-toggle').trigger('click')
    expect(wrapper.get('.iv-overall-toggle').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#overallFeedbackDetails').attributes('style')).not.toContain('display: none')
    expect(wrapper.text()).toContain('정량적인 성과를 제시했습니다.')
    expect(wrapper.text()).toContain('전반적으로 근거가 분명한 답변입니다.')
    const evidenceMark = wrapper.get('.iv-evidence-mark.is-strength')
    expect(evidenceMark.text()).toContain(evidenceText)
    await evidenceMark.trigger('mouseenter')
    expect(wrapper.get('.iv-evidence-floating-tooltip').text()).toContain('정량적 성과를 제시한 부분입니다.')
    expect(wrapper.text()).not.toContain('최근 평균 대비 +5점')
  })

  it('revokes a local video Blob and switches to the server video when the route changes', async () => {
    const createObjectURL = vi.fn(() => 'blob:interview-47')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail?id=47')
    await router.isReady()

    const interview = useInterviewStore()
    interview.interviewId = 47
    interview.finishRecording({
      videoBlob: new Blob(['video-47'], { type: 'video/webm' }),
      durationSeconds: 40,
    })
    vi.spyOn(interviewApi, 'getReport').mockImplementation(async (id) => ({
      interviewId: Number(id),
      recordingUrl: `https://example.com/interview-${id}.webm`,
      durationSeconds: 40,
      questionEvaluations: [{
        questionId: 1,
        question: 'question',
        answer: 'answer',
        startTimeSeconds: 0,
        endTimeSeconds: 40,
      }],
    }))

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.get('video').attributes('src')).toBe('blob:interview-47')

    await router.push('/interview/report/detail?id=48')
    await flushPromises()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:interview-47')
    expect(wrapper.get('video').attributes('src')).toBe('https://example.com/interview-48.webm')
  })

  it('does not let a late report response replace the newly selected interview', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    const resolvers = new Map()
    vi.spyOn(interviewApi, 'getReport').mockImplementation((id) => new Promise((resolve) => {
      resolvers.set(Number(id), resolve)
    }))

    const firstRequest = interview.loadReport(47)
    const secondRequest = interview.loadReport(48)
    resolvers.get(48)({ interviewId: 48, title: 'report-48', questionEvaluations: [] })
    await secondRequest
    resolvers.get(47)({ interviewId: 47, title: 'report-47', questionEvaluations: [] })
    await firstRequest

    expect(interview.report.interviewId).toBe(48)
    expect(interview.interviewId).toBe(48)
  })

  it('seeks to an API-timestamped answer caption and not to a synthetic fallback', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 21,
      recordingUrl: 'https://example.com/interview.webm',
      durationSeconds: 8,
      questionEvaluations: [{
        questionId: 'q-1',
        question: 'timestamped question',
        answer: 'timestamped answer',
        startTimeSeconds: 0,
        endTimeSeconds: 8,
        durationSeconds: 8,
        segments: [{
          text: 'timestamped answer',
          startTimeMs: 2500,
          endTimeMs: 4200,
        }],
      }],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const video = wrapper.get('video')
    Object.defineProperty(video.element, 'paused', { configurable: true, value: true })

    await wrapper.get('[data-caption-seek]').trigger('click')
    expect(video.element.currentTime).toBe(2.5)

    interview.report = {
      ...interview.report,
      questionEvaluations: [{
        questionId: 'q-1',
        question: 'legacy question',
        answer: 'legacy answer without timestamps',
        startTimeSeconds: 0,
        endTimeSeconds: 8,
        durationSeconds: 8,
        segments: [],
      }],
    }
    await flushPromises()
    expect(wrapper.find('[data-caption-seek]').exists()).toBe(false)
  })

  it('seeks the video with the absolute STT timestamp without rescaling it', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 21,
      recordingUrl: 'https://example.com/interview.webm',
      durationSeconds: 130,
      questionEvaluations: [
        {
          questionId: 'q-1',
          question: 'first question',
          answer: 'first answer',
          startTimeSeconds: 0,
          endTimeSeconds: 60,
          segments: [{ text: 'first answer', startTimeMs: 50000, endTimeMs: 55000 }],
        },
        {
          questionId: 'q-2',
          question: 'second question',
          answer: 'second answer',
          startTimeSeconds: 70,
          endTimeSeconds: 130,
          segments: [{ text: 'second answer', startTimeMs: 80000, endTimeMs: 85000 }],
        },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const video = wrapper.get('video')
    Object.defineProperty(video.element, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(video.element, 'paused', { configurable: true, value: true })
    await video.trigger('loadedmetadata')
    await flushPromises()

    await wrapper.findAll('.iv-rq-item')[1].trigger('click')
    await wrapper.get('[data-answer-caption]').trigger('click')

    expect(wrapper.vm.questions[1].startSec).toBe(70)
    expect(video.element.currentTime).toBe(80)
  })

  it('keeps the clicked question selected when absolute timestamp ranges overlap', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 22,
      recordingUrl: 'https://example.com/interview.webm',
      durationSeconds: 120,
      questionEvaluations: [
        {
          questionId: 'q-1',
          question: 'first question',
          answer: 'first answer',
          startTimeSeconds: 0,
          endTimeSeconds: 60,
          segments: [{ text: 'first answer', startTimeMs: 0, endTimeMs: 5000 }],
        },
        {
          questionId: 'q-2',
          question: 'second question',
          answer: 'second answer',
          startTimeSeconds: 50,
          endTimeSeconds: 100,
          segments: [{ text: 'second answer', startTimeMs: 60000, endTimeMs: 65000 }],
        },
        {
          questionId: 'q-3',
          question: 'third question',
          answer: 'third answer',
          startTimeSeconds: 60,
          endTimeSeconds: 110,
          segments: [{ text: 'third answer', startTimeMs: 90000, endTimeMs: 95000 }],
        },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const video = wrapper.get('video')
    Object.defineProperty(video.element, 'duration', { configurable: true, value: 120 })
    Object.defineProperty(video.element, 'paused', { configurable: true, value: true })
    await video.trigger('loadedmetadata')
    await flushPromises()

    await wrapper.findAll('.iv-rq-item')[1].trigger('click')
    await wrapper.get('[data-answer-caption]').trigger('click')

    expect(video.element.currentTime).toBe(60)
    expect(wrapper.vm.activeQuestionItem.question).toBe('second question')
  })

  it('uses effective durationSeconds instead of an overlapping raw end boundary', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 23,
      recordingUrl: 'https://example.com/interview.webm',
      durationSeconds: 70,
      questionEvaluations: [
        {
          questionId: 'q-2',
          question: 'short answer question',
          answer: 'short answer',
          startTimeSeconds: 51,
          endTimeSeconds: 102,
          durationSeconds: 9,
          segments: [{ text: 'short answer', startTimeMs: 51000, endTimeMs: 60000 }],
          voicePace: {
            avgPace: 1.4,
            buckets: [{ startSec: 0, endSec: 9, pace: 1.4 }],
            slowest: { startSec: 0, endSec: 9, pace: 1.4 },
            fastest: { startSec: 0, endSec: 9, pace: 1.4 },
            fillerEvents: [],
            silences: [],
          },
        },
        {
          questionId: 'q-3',
          question: 'next question',
          answer: 'next answer',
          startTimeSeconds: 60,
          endTimeSeconds: 70,
          durationSeconds: 10,
          segments: [{ text: 'next answer', startTimeMs: 60000, endTimeMs: 70000 }],
        },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.vm.questions[0].startSec).toBe(51)
    expect(wrapper.vm.questions[0].durationSec).toBe(9)
    expect(wrapper.get('.iv-pace-axis-edges').text()).toBe('0:511:00')
    expect(wrapper.get('.iv-pace-step-line').attributes('d')).toContain('L600,')
  })

  it('shows the complete timestamped STT transcript in the question feedback answer', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 21,
      durationSeconds: 8,
      questionEvaluations: [{
        questionId: 'q-1',
        question: '자기소개를 해주세요.',
        answer: '테스트는 이 정도만 만들도록 하겠습니다.',
        startTimeSeconds: 0,
        endTimeSeconds: 8,
        durationSeconds: 8,
        segments: [
          { text: '안녕하세요. 반갑습니다.', startTimeMs: 0, endTimeMs: 2500 },
          { text: '테스트는 이 정도만 만들도록 하겠습니다.', startTimeMs: 2500, endTimeMs: 8000 },
        ],
      }],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('.iv-evidence-answer').text()).toBe(
      '안녕하세요. 반갑습니다. 테스트는 이 정도만 만들도록 하겠습니다.',
    )
  })

  it('removes the leading TTS gap from the stitched answer-video timeline', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 21,
      durationSeconds: 30,
      questionEvaluations: [{
        questionId: 1,
        question: 'question',
        answer: 'answer',
        startTime: 12,
        endTime: 20,
      }],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.vm.questions[0].startSec).toBe(0)
    expect(wrapper.vm.questions[0].durationSec).toBe(8)
  })

  it('replaces interview scores when the total interview duration is shorter than 30 seconds', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      title: '짧은 면접',
      durationSeconds: 29,
      overallScore: 88,
      scoreCards: [{ label: '음성', score: 86, metrics: [] }],
      questionEvaluations: [],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('면접 시간이 너무 짧아요')
    expect(wrapper.text()).toContain(':(')
    expect(wrapper.text()).toContain('정확한 지표를 생성하기 어려워요.')
    expect(wrapper.text()).toContain('전체 면접 시간이 30초 미만이에요.')
    expect(wrapper.text()).not.toContain('면접 결과')
    expect(wrapper.text()).not.toContain('88점')
    expect(wrapper.find('.archive-report-metrics > dl').exists()).toBe(false)
    expect(wrapper.find('.archive-report-metrics header.is-short-interview').exists()).toBe(true)
  })

  it('keeps the normal interview score card from exactly 30 seconds', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      title: '정상 면접',
      durationSeconds: 30,
      overallScore: 88,
      scoreCards: [{ label: '음성', score: 86, metrics: [{ label: '필러', value: '3회' }] }],
      questionEvaluations: [],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('면접 결과')
    expect(wrapper.text()).toContain('88점')
    expect(wrapper.text()).not.toContain('면접 시간이 너무 짧아요')
    expect(wrapper.find('.archive-report-metrics > dl').exists()).toBe(true)
    expect(wrapper.get('.archive-score-breakdown > div dt').text()).toContain('추임새')
    expect(wrapper.get('.archive-score-breakdown > div dd').text()).toBe('3회')
    expect(wrapper.text()).not.toContain('필러')
  })

  it('renames the video score card to gesture and removes facial anomaly metrics', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      title: '면접 리포트',
      overallScore: 70,
      scoreCards: [{
        label: '영상',
        score: 80,
        metrics: [
          { label: '시선 이탈', value: '11회' },
          { label: '표정 이상 감지', value: '0회' },
          { label: '자세 기울기', value: '12%' },
        ],
      }],
      questionEvaluations: [
        {
          questionId: 'q-1',
          question: '첫 번째 질문',
          answer: '첫 번째 답변',
          durationSeconds: 10,
          gestureSeries: {
            gazeCount: 4,
            gazeEvents: [{ atSec: 2 }, { atSec: 4 }, { atSec: 6 }, { atSec: 8 }],
            buckets: [{ startSec: 0, endSec: 10, tiltPct: 17.84016393442623 }],
          },
        },
        {
          questionId: 'q-2',
          question: '두 번째 질문',
          answer: '두 번째 답변',
          durationSeconds: 10,
          gestureSeries: {
            gazeCount: 6,
            gazeEvents: [],
            buckets: [{ startSec: 0, endSec: 10, tiltPct: 10 }],
          },
        },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('.archive-score-metric > dt').text()).toContain('몸짓')
    expect(wrapper.get('.archive-score-detail').text()).toContain('몸짓 평가 지표')
    expect(wrapper.get('.archive-score-detail').text()).toContain('시선 이탈10회')
    expect(wrapper.get('.archive-score-detail').text()).not.toContain('시선 이탈11회')
    expect(wrapper.get('.archive-score-detail').text()).not.toContain('표정 이상 감지')
  })

  it('답변하지 않은 질문도 선택할 수 있고, 분석 불가라고 표시한다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      title: '면접 리포트',
      overallScore: 60,
      questionEvaluations: [
        { questionId: 'q-1', question: '1번 질문', answer: '1번 답변', durationSeconds: 10 },
        { questionId: 'q-2', question: '2번 질문(건너뜀)', answer: '', durationSeconds: 0 },
        { questionId: 'q-3', question: '3번 질문', answer: '3번 답변', durationSeconds: 10 },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    const items = wrapper.findAll('.iv-rq-item')
    expect(items).toHaveLength(3)
    expect(items[1].classes()).toContain('is-unmeasured')
    expect(items[1].attributes('disabled')).toBeUndefined()
    expect(items[1].text()).toContain('분석 불가')
    // 건너뛴 질문을 지나 3번 질문도 그대로 선택된다.
    await items[2].trigger('click')
    await flushPromises()
    expect(items[2].classes()).toContain('is-active')

    await items[1].trigger('click')
    await flushPromises()
    expect(wrapper.get('.iv-metric-empty').text()).toContain('분석할 수 없어요')
    expect(wrapper.get('.iv-video-question').text()).toContain('3번 질문')
    expect(wrapper.get('[data-answer-caption]').text()).toContain('3번 답변')
  })

  it('keeps the selected card and video question aligned with the stitched answer timeline', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 21,
      recordingUrl: 'https://example.com/interview.webm',
      durationSeconds: 14,
      questionEvaluations: [
        {
          questionId: 'q-1',
          question: 'first question',
          answer: 'first answer',
          startTimeSeconds: 0,
          endTimeSeconds: 5,
          durationSeconds: 8,
          segments: [{ kind: 'FILLER', startTimeSeconds: 1, endTimeSeconds: 2 }],
        },
        {
          questionId: 'q-2',
          question: 'second question',
          answer: 'second answer',
          startTimeSeconds: 8,
          endTimeSeconds: 13,
          durationSeconds: 9,
          segments: [{ kind: 'SILENCE', startTimeSeconds: 9, endTimeSeconds: 10 }],
        },
        {
          questionId: 'q-3',
          question: 'third question',
          answer: 'third answer',
          startTimeSeconds: 17,
          endTimeSeconds: 21,
          durationSeconds: 4,
          segments: [{ kind: 'FILLER', startTimeSeconds: 18, endTimeSeconds: 19 }],
        },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.vm.allSentences.map(({ text, questionIndex }) => ({ text, questionIndex }))).toEqual([
      { text: 'first answer', questionIndex: 0 },
      { text: 'second answer', questionIndex: 1 },
      { text: 'third answer', questionIndex: 2 },
    ])

    const video = wrapper.get('video')
    video.element.currentTime = 11
    await video.trigger('timeupdate')
    await flushPromises()

    expect(wrapper.get('.iv-video-question').text()).toContain('third question')
    expect(wrapper.findAll('.iv-rq-item')[2].classes()).toContain('is-active')

    await wrapper.findAll('.iv-rq-item')[2].trigger('click')
    await flushPromises()
    expect(wrapper.get('.iv-video-question').text()).toContain('third question')
    expect(wrapper.findAll('.iv-rq-item')[2].classes()).toContain('is-active')
    expect(video.element.currentTime).toBe(10)
  })

  it('keeps an unanswered question selected while the video is paused', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 146,
      recordingUrl: 'https://example.com/interview.webm',
      questionEvaluations: [
        { questionId: 'q-1', question: 'first', answer: 'first answer', startTimeSeconds: 0, endTimeSeconds: 5 },
        { questionId: 'q-2', question: 'second', answer: 'second answer', startTimeSeconds: 5, endTimeSeconds: 11 },
        {
          questionId: 'q-3',
          question: 'third',
          answer: '이 질문엔 답변하지 않았어요.',
          startTimeSeconds: 11,
          endTimeSeconds: 15,
        },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const video = wrapper.get('video')
    Object.defineProperty(video.element, 'paused', { configurable: true, value: true })

    await wrapper.findAll('.iv-rq-item')[2].trigger('click')
    await video.trigger('timeupdate')
    await flushPromises()

    expect(wrapper.findAll('.iv-rq-item')[2].classes()).toContain('is-active')
    expect(wrapper.get('.iv-video-question').text()).toContain('first')
    expect(wrapper.get('.iv-video-question').text()).not.toContain('third')
    expect(wrapper.get('[data-answer-caption]').text()).toContain('first answer')
    expect(wrapper.vm.current.answer).toBe('')
    expect(wrapper.vm.questions[2].durationSec).toBe(0)
    expect(wrapper.vm.questions[2].startSec).toBeNull()
    expect(wrapper.vm.questions[2].isVideoMapped).toBe(false)
  })

  it('does not roll back to the previous mapped question after moving past an unanswered question', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 147,
      recordingUrl: 'https://example.com/interview.webm',
      questionEvaluations: [
        { questionId: 'q-1', question: 'first', answer: 'first answer', startTimeSeconds: 0, endTimeSeconds: 5 },
        { questionId: 'q-2', question: 'second', answer: '', startTimeSeconds: 5, endTimeSeconds: 8 },
        { questionId: 'q-3', question: 'third', answer: 'third answer', startTimeSeconds: 8, endTimeSeconds: 12 },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const video = wrapper.get('video')
    Object.defineProperty(video.element, 'paused', { configurable: true, value: true })

    await wrapper.findAll('.iv-rq-item')[1].trigger('click')
    await wrapper.findAll('.iv-rq-item')[2].trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.iv-rq-item')[2].classes()).toContain('is-active')
    expect(wrapper.get('.iv-video-question').text()).toContain('third')
    expect(video.element.currentTime).toBe(5)

    // A paused media element may emit a late timeupdate carrying its previous
    // position after the application has already selected and sought question 3.
    video.element.currentTime = 0
    await video.trigger('timeupdate')
    await flushPromises()

    expect(wrapper.findAll('.iv-rq-item')[2].classes()).toContain('is-active')
    expect(wrapper.get('.iv-video-question').text()).toContain('third')
    expect(wrapper.vm.absoluteVideoSec).toBe(5)

    video.element.currentTime = 5
    await video.trigger('seeked')
    Object.defineProperty(video.element, 'paused', { configurable: true, value: false })
    video.element.currentTime = 6
    await video.trigger('timeupdate')
    await flushPromises()

    expect(wrapper.findAll('.iv-rq-item')[2].classes()).toContain('is-active')
    expect(wrapper.vm.absoluteVideoSec).toBe(6)
  })

  it('keeps the last question selected when the real video is much shorter than server question boundaries', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      interviewId: 144,
      recordingUrl: 'https://example.com/short-stitched.webm',
      durationSeconds: 17,
      questionEvaluations: [
        { questionId: 'q-1', question: 'first', answer: 'first answer', startTimeSeconds: 0, endTimeSeconds: 5 },
        { questionId: 'q-2', question: 'second', answer: 'second answer', startTimeSeconds: 8, endTimeSeconds: 13 },
        { questionId: 'q-3', question: 'third', answer: 'third answer', startTimeSeconds: 17, endTimeSeconds: 21 },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    const video = wrapper.get('video')
    Object.defineProperty(video.element, 'duration', { configurable: true, value: 3.778399 })
    await video.trigger('loadedmetadata')
    await flushPromises()

    await wrapper.findAll('.iv-rq-item')[2].trigger('click')
    await video.trigger('timeupdate')
    await flushPromises()

    expect(wrapper.findAll('.iv-rq-item')[2].classes()).toContain('is-active')
    expect(wrapper.get('.iv-video-question').text()).toContain('third')
    expect(wrapper.get('.iv-rq-q-title').text()).toContain('third')
    expect(wrapper.get('[data-answer-caption]').text()).toContain('third answer')
    expect(wrapper.get('[data-answer-caption]').text()).not.toContain('second answer')
    expect(video.element.currentTime).toBeLessThan(3.778399)
    expect(wrapper.get('.iv-video-time').text()).toContain('/ 0:04')
  })
})
