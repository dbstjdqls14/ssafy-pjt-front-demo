import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { usePresentationStore } from '../../src/stores/presentationStore.js'
import PresentationRecordView from '../../src/views/presentation/PresentationRecordView.vue'

describe('PresentationRecordView audio analysis status', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.setItem('aivo.presentation-record-tutorial-seen:guest', 'true')
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  test('shows the 10-second API state before the first response arrives', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const presentation = usePresentationStore()
    presentation.uploadStatus = 'ready'
    presentation.setSlides([
      { slideId: 1, slideNumber: 1, imageUrl: '/slide.png', description: '설명' },
    ])
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/record', component: PresentationRecordView },
        { path: '/presentation/artifacts', component: { template: '<div />' } },
        { path: '/presentation/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/record')
    await router.isReady()

    const wrapper = mount(PresentationRecordView, {
      global: { plugins: [pinia, router] },
    })
    await flushPromises()

    expect(wrapper.get('[data-audio-analysis-state]').text()).toContain('첫 10초')
    wrapper.unmount()
  })
})
