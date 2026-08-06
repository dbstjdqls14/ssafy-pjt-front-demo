import { beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { presentationApi } from '../../src/api/presentationApi.js'
import PresentationReportDetailView from '../../src/views/presentation/PresentationReportDetailView.vue'
import PresentationReadyView from '../../src/views/presentation/PresentationReadyView.vue'
import PresentationRecordView from '../../src/views/presentation/PresentationRecordView.vue'
import PresentationSlidesView from '../../src/views/presentation/PresentationSlidesView.vue'
import { usePresentationStore } from '../../src/stores/presentationStore.js'

const routes = [
  { path: '/', component: { template: '<div />' } },
  { path: '/presentation/setup', component: { template: '<div />' } },
  { path: '/presentation/slides', component: PresentationSlidesView },
  { path: '/presentation/check', component: { template: '<div />' } },
  { path: '/presentation/record', component: PresentationRecordView },
  { path: '/archive/detail/:id?', component: PresentationReportDetailView },
  { path: '/archive/folders/:id?', component: { template: '<div />' } },
]

const seedUploadedSlides = (store) => {
  store.sourceFile = { name: 'team-demo.pptx', size: 1024, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
  store.uploadStatus = 'ready'
  store.setSlides([
    { slideId: 'slide-1', title: '팀 소개', imageUrl: '/converted/slide-1.png', thumbnailUrl: '/converted/slide-1-thumb.png', keyPoints: '팀의 강점을 설명한다.' },
    { slideId: 'slide-2', title: '서비스 구조', imageUrl: '/converted/slide-2.png', thumbnailUrl: '/converted/slide-2-thumb.png', keyPoints: '구조를 간단히 설명한다.' },
  ])
}

const mountAt = async (component, path) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const store = usePresentationStore()
  seedUploadedSlides(store)
  const wrapper = mount(component, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, store }
}

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

describe('uploaded presentation slide flow', () => {
  test('shows the converted slide on the key-points screen', async () => {
    const { wrapper } = await mountAt(PresentationSlidesView, '/presentation/slides')
    expect(wrapper.get('.slide-preview-image').attributes('src')).toBe('/converted/slide-1.png')
  })

  test('shows the same converted slide on ready and recording screens', async () => {
    const ready = await mountAt(PresentationReadyView, '/')
    expect(ready.wrapper.get('.ready-slide-image').attributes('src')).toBe('/converted/slide-1.png')
    ready.wrapper.unmount()

    const record = await mountAt(PresentationRecordView, '/presentation/record')
    expect(record.wrapper.get('.record-slide-image').attributes('src')).toBe('/converted/slide-1.png')
    expect(record.wrapper.get('.record-side-image').attributes('src')).toBe('/converted/slide-2.png')
  })

  test('shows a presentation-only zoom rail for an A4 PDF slide', async () => {
    const slides = await mountAt(PresentationSlidesView, '/presentation/slides')
    slides.store.sourceFile = { name: 'a4-handout.pdf', size: 1024, type: 'application/pdf' }
    const setupImage = slides.wrapper.get('.slide-preview-image')
    Object.defineProperties(setupImage.element, {
      naturalWidth: { configurable: true, value: 842 },
      naturalHeight: { configurable: true, value: 595 },
    })
    await setupImage.trigger('load')

    expect(slides.wrapper.get('.presentation-slide-zoom').exists()).toBe(true)
    await slides.wrapper.get('.presentation-slide-zoom [aria-label="슬라이드 확대"]').trigger('click')
    expect(slides.wrapper.get('.slide-preview-viewport').attributes('style')).toContain('--slide-zoom: 1.2')
    slides.wrapper.unmount()

    const record = await mountAt(PresentationRecordView, '/presentation/record')
    record.store.sourceFile = { name: 'a4-handout.pdf', size: 1024, type: 'application/pdf' }
    const recordImage = record.wrapper.get('.record-slide-image')
    Object.defineProperties(recordImage.element, {
      naturalWidth: { configurable: true, value: 842 },
      naturalHeight: { configurable: true, value: 595 },
    })
    await recordImage.trigger('load')

    expect(record.wrapper.get('.presentation-slide-zoom').exists()).toBe(true)
  })

  test('shows report slide thumbnails and AI feedback from the presentation API', async () => {
    vi.spyOn(presentationApi, 'getReport').mockResolvedValue({
      status: 'COMPLETED',
      practice: { practiceId: 91, title: '팀 소개', practicedAt: '2026-08-03T10:00:00', durationMs: 20_000 },
      presentation: { presentationId: 31, slideCount: 2 },
      score: { overallScore: 88, deliveryScore: 87, nonverbalScore: 86, contentRelevanceScore: 90 },
      media: { video: { playbackUrl: '/recording.webm' } },
      slides: [
        {
          slideId: 1,
          slideNumber: 1,
          title: '팀 소개',
          imageUrl: '/converted/slide-1-thumb.png',
          startTimeSec: 0,
          endTimeSec: 10,
          feedback: { content: '팀의 역할을 명확하게 설명했습니다.' },
        },
        {
          slideId: 2,
          slideNumber: 2,
          title: '서비스 구조',
          imageUrl: '/converted/slide-2-thumb.png',
          startTimeSec: 10,
          endTimeSec: 20,
          feedback: { content: '서비스 구조의 연결 관계를 보완해 주세요.' },
        },
      ],
      speechAnalysis: { windows: [] },
      gestureSeries: { buckets: [], gazeEvents: [] },
    })
    const { wrapper } = await mountAt(PresentationReportDetailView, '/archive/detail?id=report-31&presentationId=31')

    const thumbnails = wrapper.findAll('[data-slide-thumbnail] img')
    expect(thumbnails).toHaveLength(2)
    expect(thumbnails[0].attributes('src')).toBe('/converted/slide-1-thumb.png')
    expect(wrapper.get('[data-slide-feedback]').text()).toContain('팀의 역할을 명확하게 설명했습니다.')
    expect(wrapper.find('[data-transcript-highlight]').exists()).toBe(false)
  })
})
