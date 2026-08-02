import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { practiceApi } from '../../src/api/practiceApi.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'
import FolderSelectView from '../../src/views/practice/FolderSelectView.vue'

const folderResponse = {
  folders: [
    {
      folderId: 7,
      folderName: '서비스 소개 발표',
      practiceType: 'presentation',
      presentationFileName: 'aivo-v1.pdf',
      attemptCount: 2,
      bestScore: 84,
    },
  ],
}

const mountView = async (type = 'presentation') => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/practice/folders', component: FolderSelectView },
      { path: '/presentation/setup', component: { template: '<div>setup</div>' } },
      { path: '/interview/setup', component: { template: '<div>setup</div>' } },
      { path: '/practice', component: { template: '<div>practice</div>' } },
    ],
  })
  await router.push(`/practice/folders?type=${type}`)
  await router.isReady()

  const wrapper = mount(FolderSelectView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router, practice: usePracticeStore() }
}

describe('FolderSelectView real folder selection', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(practiceApi, 'listFolders').mockResolvedValue(folderResponse)
  })

  test('keeps the selected server folder id and moves to setup', async () => {
    const { wrapper, router, practice } = await mountView()
    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    expect(practice.folderId).toBe('7')
    expect(router.currentRoute.value.path).toBe('/presentation/setup')
  })

  test.each(['presentation', 'interview'])('shows only the create-folder empty state when there is no %s folder', async (type) => {
    vi.mocked(practiceApi.listFolders).mockResolvedValue({ folders: [] })

    const { wrapper } = await mountView(type)

    expect(wrapper.get('.folder-preview-empty').text()).toContain('새 폴더를 만드세요')
    expect(wrapper.find('.folder-preview-summary').exists()).toBe(false)
    expect(wrapper.find('.folder-material-action').exists()).toBe(false)
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()

    await wrapper.get('.folder-preview-empty button').trigger('click')
    expect(wrapper.find('.folder-new-panel').isVisible()).toBe(true)
  })

  test('hard-limits a new folder description to 50 characters', async () => {
    vi.mocked(practiceApi.listFolders).mockResolvedValue({ folders: [] })
    const { wrapper } = await mountView('interview')
    await wrapper.get('.folder-preview-empty button').trigger('click')

    const textarea = wrapper.get('#newFolderDesc')
    await textarea.setValue('가'.repeat(59))
    await flushPromises()

    expect(textarea.element.value).toHaveLength(50)
    expect(wrapper.get('.folder-desc-counter').text()).toBe('50/50')
  })
})
