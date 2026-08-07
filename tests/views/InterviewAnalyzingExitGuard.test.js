import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, test, vi } from 'vitest'

import { useInterviewStore } from '../../src/stores/interviewStore.js'
import InterviewAnalyzingView from '../../src/views/interview/InterviewAnalyzingView.vue'

describe('InterviewAnalyzingView exit guard', () => {
  test('shows the background-analysis notice only after report polling is confirmed', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    vi.spyOn(interview, 'beginAnalysis').mockImplementation(async () => {
      interview.analysisStatus = 'processing'
    })
    vi.spyOn(interview, 'pollAnalysis').mockImplementation(async () => {
      interview.reportJob = { status: 'STT_ANALYZING' }
      return { status: 'processing', progress: 45 }
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/interview/analyzing', component: InterviewAnalyzingView }],
    })
    await router.push('/interview/analyzing')
    await router.isReady()
    const wrapper = mount(InterviewAnalyzingView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="interview-background-analysis-notice"]').text())
      .toContain('분석 결과를 준비하고 있어요')
    expect(wrapper.get('[data-testid="interview-background-analysis-notice"]').text())
      .toContain('페이지를 이동해도 분석은 계속되며, 완료 후 내 기록에서 확인할 수 있습니다.')

    wrapper.unmount()
    vi.useRealTimers()
  })

  test('shows new-practice guidance without a reanalysis button after analysis fails', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    interview.analysisStatus = 'failed'
    interview.analysisError = '분석 파일을 읽을 수 없습니다.'
    vi.spyOn(interview, 'beginAnalysis').mockResolvedValue(undefined)
    vi.spyOn(interview, 'pollAnalysis').mockResolvedValue({ status: 'failed' })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/interview/analyzing', component: InterviewAnalyzingView }],
    })
    await router.push('/interview/analyzing')
    await router.isReady()
    const wrapper = mount(InterviewAnalyzingView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('분석 파일을 읽을 수 없습니다.')
    expect(wrapper.text()).toContain('새 연습을 시작해 다시 시도해주세요.')
    expect(wrapper.text()).not.toContain('다시 분석하기')
    expect(wrapper.find('.analysis-retry-button').exists()).toBe(false)
    wrapper.unmount()
  })

  test('complete 응답 후 백그라운드 분석 중에는 경고 없이 이탈한다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    vi.spyOn(interview, 'beginAnalysis').mockImplementation(async () => {
      interview.analysisStatus = 'processing'
    })
    vi.spyOn(interview, 'pollAnalysis').mockImplementation(async () => {
      interview.reportJob = { status: 'STT_ANALYZING' }
      return { status: 'processing', progress: 45 }
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/analyzing', component: InterviewAnalyzingView },
        { path: '/practice', component: { template: '<div>practice</div>' } },
      ],
    })
    await router.push('/interview/analyzing')
    await router.isReady()
    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="interview-background-analysis-notice"]').exists()).toBe(true)
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true)

    await router.push('/practice')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/practice')
    expect(wrapper.find('[data-testid="interview-analysis-exit-dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  test('분석 중 라우트 이탈은 확인 전까지 막는다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    vi.spyOn(interview, 'beginAnalysis').mockResolvedValue(undefined)
    vi.spyOn(interview, 'pollAnalysis').mockImplementation(() => new Promise(() => {}))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/analyzing', component: InterviewAnalyzingView },
        { path: '/practice', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/analyzing')
    await router.isReady()
    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [pinia, router] } })
    await flushPromises()

    void router.push('/practice')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/interview/analyzing')
    expect(wrapper.get('[data-testid="interview-analysis-exit-dialog"]').text()).toContain('분석이 진행 중입니다')

    await wrapper.get('[data-testid="continue-interview-analysis"]').trigger('click')
    expect(wrapper.find('[data-testid="interview-analysis-exit-dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  test('면접 분석 폴링은 5분을 지나도 계속하고 10분에 시간 초과 처리한다', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    vi.spyOn(interview, 'beginAnalysis').mockResolvedValue(undefined)
    vi.spyOn(interview, 'pollAnalysis').mockResolvedValue({ status: 'processing', progress: 50 })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/analyzing', component: InterviewAnalyzingView },
        { path: '/interview/report', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/analyzing')
    await router.isReady()
    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(interview.analysisStatus).not.toBe('failed')

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(interview.analysisStatus).toBe('failed')
    expect(interview.analysisError).toContain('10분')

    wrapper.unmount()
    vi.useRealTimers()
  })
})
