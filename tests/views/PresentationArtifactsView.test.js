import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { presentationApi } from '../../src/api/presentationApi.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import PresentationArtifactsView from '../../src/views/presentation/PresentationArtifactsView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob) => `blob:${blob.type}`),
    revokeObjectURL: vi.fn(),
  })
})

describe('presentation artifact review', () => {
  test('shows the generated WebM, WAV, text, and detects before completion', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.slideTimeline = [{ slideId: 101, slideIndex: 0, startedAtMs: 0, endedAtMs: 12_000 }]
    store.setRecordingArtifacts({
      webmBlob: new Blob(['video'], { type: 'video/webm' }),
      wavBlob: new Blob(['audio'], { type: 'audio/wav' }),
      text: [{ page: 1, timestamp: 0, content: '발표 내용' }],
      detects: [{
        timestamp: 0,
        sequence: 0,
        bodyStability: { average: 82.4, outlierList: [] },
        sideGlance: [],
      }],
      durationMs: 12_000,
    })

    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/presentation/artifacts', component: PresentationArtifactsView },
        { path: '/presentation/report', component: { template: '<div>report</div>' } },
      ],
    })
    await router.push('/presentation/artifacts')
    await router.isReady()
    const wrapper = mount(PresentationArtifactsView, {
      global: { plugins: [router] },
    })

    expect(wrapper.findAll('[data-artifact-card]')).toHaveLength(4)
    expect(wrapper.text()).toContain('WebM')
    expect(wrapper.text()).toContain('WAV')
    expect(wrapper.text()).toContain('text[]')
    expect(wrapper.text()).toContain('detects[]')
    expect(wrapper.get('[data-json="text"]').text()).toContain('"page": 1')
    expect(wrapper.get('[data-json="detects"]').text()).toContain('"sequence": 0')
  })

  test('sends only durationMs to Spring when the user confirms', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.setRecordingArtifacts({
      webmBlob: new Blob(['video'], { type: 'video/webm' }),
      wavBlob: new Blob(['audio'], { type: 'audio/wav' }),
      text: [],
      detects: [],
      durationMs: 12_345,
    })
    const complete = vi.spyOn(presentationApi, 'complete').mockResolvedValue('')
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/presentation/artifacts', component: PresentationArtifactsView },
        { path: '/presentation/report', component: { template: '<div>report</div>' } },
      ],
    })
    await router.push('/presentation/artifacts')
    await router.isReady()
    const wrapper = mount(PresentationArtifactsView, {
      global: { plugins: [router] },
    })

    await wrapper.get('.artifact-complete-button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/presentation/report'))

    expect(complete).toHaveBeenCalledWith(9, 12_345)
  })
})
