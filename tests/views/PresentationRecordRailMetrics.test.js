import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { usePresentationStore } from '../../src/stores/presentationStore.js'
import { useRecordingStore } from '../../src/stores/recordingStore.js'
import PresentationRecordView from '../../src/views/presentation/PresentationRecordView.vue'

const mountRecordView = async () => {
  const presentation = usePresentationStore()
  presentation.uploadStatus = 'ready'
  presentation.setSlides([
    { slideId: 1, slideNumber: 1, imageUrl: '/slide.png', description: '설명' },
  ])
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
  const wrapper = mount(PresentationRecordView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { presentation, wrapper }
}

describe('PresentationRecordView 실시간 분석 레일', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    localStorage.setItem('aivo.presentation-record-tutorial-seen:guest', 'true')
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  test('keeps the live filler count as the cumulative 10-second API total', async () => {
    const presentation = usePresentationStore()
    presentation.audioAnalysisResults = [
      { sequence: 0, fillerCount: 2 },
      { sequence: 1, fillerCount: 0 },
      { sequence: 1, fillerCount: 0 },
    ]
    const { wrapper } = await mountRecordView()

    expect(wrapper.get('[data-live-filler-count]').text()).toBe('2')
    expect(wrapper.get('[data-live-filler-count]').element.nextElementSibling?.textContent).toBe('추임새 회')
    wrapper.unmount()
  })

  test('말하기 속도를 숫자 대신 느림·보통·빠름으로 보여준다', async () => {
    const { wrapper } = await mountRecordView()
    const recording = useRecordingStore()

    expect(wrapper.get('[data-live-pace-label]').text()).toBe('--')

    recording.setStats({ syllablesPerSecond: 3 })
    await flushPromises()
    expect(wrapper.get('[data-live-pace-label]').text()).toBe('보통')

    recording.setStats({ syllablesPerSecond: 2.4 })
    await flushPromises()
    expect(wrapper.get('[data-live-pace-label]').text()).toBe('느림')

    recording.setStats({ syllablesPerSecond: 4.1 })
    await flushPromises()
    expect(wrapper.get('[data-live-pace-label]').text()).toBe('빠름')
    // 숫자는 화면에서 빠지고 툴팁으로만 남는다.
    expect(wrapper.get('.rail-pace-cell').attributes('title')).toContain('4.1')
    wrapper.unmount()
  })

  test('음성 크기·10초 분석 카드는 레일에서 노출하지 않는다', async () => {
    const { wrapper } = await mountRecordView()

    expect(wrapper.find('[data-audio-analysis-state]').exists()).toBe(false)
    expect(wrapper.find('.coach-audio-state').exists()).toBe(false)
    wrapper.unmount()
  })
})
