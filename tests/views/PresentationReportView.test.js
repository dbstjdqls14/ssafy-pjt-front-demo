import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { presentationApi } from '../../src/api/presentationApi.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import PresentationReportView from '../../src/views/presentation/PresentationReportView.vue'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('PresentationReportView', () => {
  test('loads the real presentation report and renders the same score-result UI as interview', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.sessionId = 12
    const getReport = vi.spyOn(presentationApi, 'getReport').mockResolvedValue({
      practice: { practiceId: 35, title: '서비스 소개 발표', durationSec: 40 },
      presentation: { presentationId: 12, slideCount: 3 },
      score: { overallScore: 91, contentScore: 90, voiceScore: 92, videoScore: 89 },
      slides: [],
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/report', component: PresentationReportView },
        { path: '/archive/detail', component: { template: '<div />' } },
        { path: '/', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/report')
    await router.isReady()

    const wrapper = mount(PresentationReportView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(getReport).toHaveBeenCalledWith(12)
    expect(wrapper.find('.score-reveal').exists()).toBe(true)
    expect(wrapper.find('.score-ring').exists()).toBe(true)
    expect(wrapper.text()).toContain('91')
    expect(wrapper.text()).toContain('자신감 넘치는 발표였어요!')
    expect(wrapper.text()).not.toContain('발표 저장 완료')
    expect(wrapper.get('a.btn-primary').attributes('href')).toContain('/archive/detail?presentationId=12')
  })
})
