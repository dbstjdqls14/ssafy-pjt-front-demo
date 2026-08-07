import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { presentationApi } from '../../src/api/presentationApi.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import PresentationSlidesView from '../../src/views/presentation/PresentationSlidesView.vue'

const mountView = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const presentation = usePresentationStore()
  presentation.sessionId = 91
  presentation.uploadStatus = 'ready'
  presentation.setSlides([
    { slideId: 1, slideNumber: 1, imageUrl: '/slide-1.png', description: '첫 슬라이드' },
    { slideId: 2, slideNumber: 2, imageUrl: '/slide-2.png', description: '둘째 슬라이드' },
  ])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/presentation/slides', component: PresentationSlidesView },
      { path: '/presentation/setup', component: { template: '<div />' } },
      { path: '/presentation/check', component: { template: '<div />' } },
      { path: '/presentation/ready', component: { template: '<div />' } },
    ],
  })
  await router.push('/presentation/slides')
  await router.isReady()
  const wrapper = mount(PresentationSlidesView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, presentation, router }
}

describe('PresentationSlidesView text policy', () => {
  afterEach(() => vi.restoreAllMocks())

  test('keeps an invalid slide note visible and blocks the save request', async () => {
    const updateDescriptions = vi.spyOn(presentationApi, 'updateDescriptions')
    const { wrapper } = await mountView()
    const note = wrapper.get('#noteInput')

    expect(note.attributes('maxlength')).toBeUndefined()
    await note.setValue('핵심👨‍👩‍👧‍👦')

    expect(note.element.value).toBe('핵심👨‍👩‍👧‍👦')
    expect(wrapper.get('[data-testid="slide-note-counter"]').text()).toBe('3/500')
    expect(wrapper.get('[data-testid="slide-note-error"]').text()).toContain('이모지')

    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()
    expect(updateDescriptions).not.toHaveBeenCalled()

    await note.setValue('이 슬라이드의 핵심입니다.')
    expect(wrapper.find('[data-testid="slide-note-error"]').exists()).toBe(false)
  })

  test('caps slide notes and accepts PPT punctuation and multilingual text', async () => {
    const { wrapper } = await mountView()
    const note = wrapper.get('#noteInput')

    await note.setValue('日'.repeat(501))
    expect(note.element.value).toBe('日'.repeat(500))
    expect(wrapper.get('[data-testid="slide-note-counter"]').text()).toBe('500/500')

    await note.setValue('‘오늘의 건수’ ··· 日本語\t© ♥ ℃ →')
    expect(note.element.value).toBe('‘오늘의 건수’ ··· 日本語\t© ♥ ℃ →')
    expect(wrapper.find('[data-testid="slide-note-error"]').exists()).toBe(false)
  })
})
