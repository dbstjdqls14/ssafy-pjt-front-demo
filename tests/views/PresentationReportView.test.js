import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, test } from 'vitest'

import { usePresentationStore } from '../../src/stores/presentationStore.js'
import PresentationReportView from '../../src/views/presentation/PresentationReportView.vue'

describe('PresentationReportView', () => {
  test('shows only captured values and does not invent a score or archive report', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.setRecordedSeconds(25)
    presentation.setRecordingArtifacts({
      durationMs: 25_000,
      text: [{ page: 1, timestamp: 0, content: '발표' }],
      detects: [{
        timestamp: 0,
        sequence: 0,
        bodyStability: { average: 90, outlierList: [] },
        sideGlance: [],
      }],
    })

    const wrapper = mount(PresentationReportView, {
      global: {
        plugins: [pinia],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('0:25')
    expect(wrapper.text()).toContain('1개')
    expect(wrapper.text()).toContain('상세 리포트 조회 API가 없어')
    expect(wrapper.text()).not.toContain('84')
    expect(wrapper.text()).not.toContain('AI가 분석한 상세 리포트')
  })
})
