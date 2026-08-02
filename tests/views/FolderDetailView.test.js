import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { archiveApi } from '../../src/api/index.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'
import FolderDetailView from '../../src/views/archive/FolderDetailView.vue'

describe('FolderDetailView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('shows the description kept from a newly created folder when detail API omits it', async () => {
    vi.spyOn(archiveApi, 'getFolderDetail').mockResolvedValue({
      folderId: 5,
      name: '테스트 5',
      attemptCount: 1,
      maxScore: 13,
      totalDuration: 39,
    })
    vi.spyOn(archiveApi, 'getFolderScoreTrend').mockResolvedValue({ scores: [] })
    vi.spyOn(archiveApi, 'getFolderPractices').mockResolvedValue({ practices: [], totalPages: 1 })

    const pinia = createPinia()
    setActivePinia(pinia)
    const practice = usePracticeStore()
    practice.folders = [{ id: '5', name: '테스트 5', description: '면접 대비 연습 폴더 설명' }]

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/archive', component: { template: '<div />' } },
        { path: '/archive/folders/:id', component: FolderDetailView },
      ],
    })
    await router.push('/archive/folders/5?type=interview')
    await router.isReady()

    const wrapper = mount(FolderDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('.folder-detail-desc').text()).toBe('면접 대비 연습 폴더 설명')
  })
})
