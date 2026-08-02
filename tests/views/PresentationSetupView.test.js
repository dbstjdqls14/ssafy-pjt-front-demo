import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, test, vi } from 'vitest'

import { usePresentationStore } from '../../src/stores/presentationStore.js'
import PresentationSetupView from '../../src/views/presentation/PresentationSetupView.vue'

describe('PresentationSetupView', () => {
  test('requires the description that Spring validates with @NotBlank', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/setup', component: PresentationSetupView },
        { path: '/presentation/slides', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/setup')
    await router.isReady()

    const presentation = usePresentationStore()
    presentation.stagePresentationFile(
      new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }),
    )
    vi.spyOn(presentation, 'uploadPresentation').mockResolvedValue([])

    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })
    await wrapper.get('#title').setValue('API 발표')

    expect(wrapper.get('label[for="description"]').text()).not.toContain('선택')
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()

    await wrapper.get('#description').setValue('Spring 계약에 맞춘 발표 연습')
    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    expect(presentation.setDescription).toBeDefined()
    expect(presentation.description).toBe('Spring 계약에 맞춘 발표 연습')
    expect(router.currentRoute.value.path).toBe('/presentation/slides')
  })
})
