import { beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import ArchiveDetailView from '../../src/views/archive/ArchiveDetailView.vue'
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
  { path: '/archive/detail/:id?', component: ArchiveDetailView },
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

  test('shows converted slide thumbnails below the report video area', async () => {
    const { wrapper, store } = await mountAt(ArchiveDetailView, '/archive/detail?id=session-with-slides')
    store.sessionId = 'session-with-slides'
    store.report = { overallScore: 88, slides: store.slides }
    await flushPromises()

    const thumbnails = wrapper.findAll('.archive-slide-thumb-img')
    expect(thumbnails).toHaveLength(2)
    expect(thumbnails[0].attributes('src')).toBe('/converted/slide-1-thumb.png')

    const voicePanel = wrapper.get('.iv-pace-panel')
    expect(voicePanel.get('.iv-pace-chart').findAll('.iv-pace-range-mark')).toHaveLength(0)
    expect(voicePanel.get('.iv-pace-range-lane').findAll('.iv-pace-range-mark')).toHaveLength(2)
  })

  test('selects a slide thumbnail and shows its speech in the feedback section', async () => {
    const { wrapper, store } = await mountAt(ArchiveDetailView, '/archive/detail?id=session-with-slides')
    store.sessionId = 'session-with-slides'
    store.report = { overallScore: 88, slides: store.slides }
    await flushPromises()

    const feedbackThumbnails = wrapper.findAll('.archive-slide-feedback-thumb')
    expect(feedbackThumbnails).toHaveLength(2)
    expect(feedbackThumbnails[0].get('img').attributes('src')).toBe('/converted/slide-1-thumb.png')
    expect(feedbackThumbnails[0].find('.archive-slide-feedback-meta').exists()).toBe(false)

    await feedbackThumbnails[1].trigger('click')

    expect(feedbackThumbnails[1].classes()).toContain('is-active')
    expect(wrapper.get('.archive-slide-feedback-detail .iv-rq-q-title').text()).toContain('서비스 구조')
    expect(wrapper.get('.archive-slide-speech').text()).toContain('저희 서비스는 발표와 면접 연습을 돕는 AI 코칭 플랫폼입니다.')
  })
})
