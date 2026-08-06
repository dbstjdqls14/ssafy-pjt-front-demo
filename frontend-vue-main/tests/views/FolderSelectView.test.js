import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { archiveApi } from '../../src/api/archiveApi.js'
import { practiceApi } from '../../src/api/practiceApi.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import FolderSelectView from '../../src/views/practice/FolderSelectView.vue'

const folderResponse = {
  folders: [{
    folderId: 7,
    folderName: '서비스 소개 발표',
    practiceType: 'presentation',
    presentationFileName: 'aivo-v1.pdf',
    attemptCount: 2,
    bestScore: 84,
  }],
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
  return { wrapper, router, practice: usePracticeStore(), presentation: usePresentationStore() }
}

describe('FolderSelectView folder picking', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(practiceApi, 'listFolders').mockResolvedValue(folderResponse)
    vi.spyOn(archiveApi, 'listFolders').mockResolvedValue({
      totalElements: 1,
      currentPage: 0,
      totalPage: 1,
      hasNext: false,
      folders: [{ folderId: 7, type: 'presentation', attemptCount: 1 }],
    })
    vi.spyOn(archiveApi, 'listPractices').mockResolvedValue({
      attemptCount: 0,
      currentPage: 0,
      totalPages: 0,
      hasNext: false,
      practices: [],
    })
  })

  test('carries the picked folder into setup without any material picker', async () => {
    const { wrapper, router, practice } = await mountView()

    expect(wrapper.find('.folder-material-action').exists()).toBe(false)
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('자료 변경')

    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    expect(practice.folderId).toBe('7')
    expect(router.currentRoute.value.path).toBe('/presentation/setup')
  })

  test('clears the previous presentation draft when entering setup', async () => {
    const { wrapper, presentation } = await mountView()
    presentation.selectReusableMaterial({ presentationId: 42, title: '이전 자료', date: '2026.08.01' })

    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    expect(presentation.reusedSource).toBeNull()
    expect(presentation.stagedFile).toBeNull()
  })

  test.each(['presentation', 'interview'])('shows only the create-folder empty state when there is no %s folder', async (type) => {
    vi.mocked(practiceApi.listFolders).mockResolvedValue({ folders: [] })

    const { wrapper } = await mountView(type)

    expect(wrapper.get('.folder-preview-empty').text()).toContain('새 폴더를 만드세요')
    expect(wrapper.find('.folder-preview-summary').exists()).toBe(false)
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()

    await wrapper.get('.folder-preview-empty button').trigger('click')
    expect(wrapper.find('.folder-new-panel').isVisible()).toBe(true)
  })

  test.each(['presentation', 'interview'])('shows archive scores and the latest three completed %s practices', async (type) => {
    vi.mocked(practiceApi.listFolders).mockResolvedValue({
      folders: [{
        folderId: 7,
        name: type === 'presentation' ? '서비스 소개 발표' : '백엔드 면접',
        description: '완료 기록만 보여주는 폴더입니다.',
        type,
        attemptCount: 9,
      }],
    })
    vi.mocked(archiveApi.listFolders).mockResolvedValue({
      totalElements: 1,
      currentPage: 0,
      totalPage: 1,
      hasNext: false,
      folders: [{ folderId: 7, type, attemptCount: 4, maxScore: 91, recentScore: 88 }],
    })
    vi.mocked(archiveApi.listPractices).mockResolvedValue({
      attemptCount: 4,
      practices: [
        { practiceId: 104, type, title: '네 번째', overallScore: 88, createdAt: '2026-07-20T10:00:00' },
        { practiceId: 103, type, title: '세 번째', overallScore: 84, createdAt: '2026-07-18T10:00:00' },
        { practiceId: 102, type, title: '두 번째', overallScore: 79, createdAt: '2026-07-15T10:00:00' },
        { practiceId: 101, type, title: '첫 번째', overallScore: 70, createdAt: '2026-07-10T10:00:00' },
      ],
    })

    const { wrapper } = await mountView(type)

    expect(wrapper.get('.folder-row-score').text()).toBe('최근 88점')
    expect(wrapper.get('.folder-preview-score').text()).toContain('최고 점수')
    expect(wrapper.get('.folder-preview-score').text()).toContain('91점')
    expect(wrapper.findAll('.folder-preview-history-item')).toHaveLength(3)
    expect(wrapper.get('.folder-preview-history').text()).toContain('4회')
    expect(wrapper.get('.folder-preview-history').text()).toContain('3회')
    expect(wrapper.get('.folder-preview-history').text()).toContain('2회')
    expect(wrapper.get('.folder-preview-history').text()).toContain('7월 20일')
    expect(wrapper.get('.folder-preview-history').text()).toContain('88점')
  })

  test('shows an honest empty state when a folder has no completed practice', async () => {
    vi.mocked(practiceApi.listFolders).mockResolvedValue({
      folders: [{ folderId: 7, name: '새 발표 폴더', type: 'presentation' }],
    })
    vi.mocked(archiveApi.listFolders).mockResolvedValue({
      totalPage: 1,
      folders: [{ folderId: 7, type: 'presentation', attemptCount: 0, maxScore: null, recentScore: null }],
    })

    const { wrapper } = await mountView()

    expect(wrapper.get('.folder-row-score').text()).toBe('기록 없음')
    expect(wrapper.get('.folder-row-score').classes()).toContain('is-empty')
    expect(wrapper.get('.folder-preview-score dd').text()).toBe('기록 없음')
    expect(wrapper.get('.folder-preview-history-empty').text()).toBe('기록 없음')
    expect(wrapper.get('.folder-preview-history-empty').classes()).toContain('is-empty')
    expect(wrapper.find('.folder-preview-history-item').exists()).toBe(false)
    expect(wrapper.get('.folder-preview-summary').text()).not.toContain('0점')
    expect(wrapper.get('.folder-preview-summary').text()).not.toContain('데이터 없음')
  })

  test('shows the completed report count from the archive API instead of created sessions', async () => {
    vi.mocked(practiceApi.listFolders).mockResolvedValue({
      folders: [{ folderId: 7, name: '완료 리포트 폴더', type: 'presentation', attemptCount: 3 }],
    })
    vi.mocked(archiveApi.listFolders).mockResolvedValue({
      totalElements: 1,
      currentPage: 0,
      totalPage: 1,
      hasNext: false,
      folders: [{ folderId: 7, type: 'presentation', attemptCount: 1 }],
    })

    const { wrapper } = await mountView()

    expect(wrapper.get('.folder-row').text()).toContain('1회 연습')
    expect(wrapper.get('.folder-row').text()).not.toContain('3회 연습')
    expect(wrapper.find('.folder-preview-visual').exists()).toBe(false)
  })

  test('selects duplicate folder names independently by folder id', async () => {
    vi.mocked(practiceApi.listFolders).mockResolvedValue({
      folders: [
        { folderId: 7, name: '같은 이름', description: '첫 번째', type: 'presentation' },
        { folderId: 8, name: '같은 이름', description: '두 번째', type: 'presentation' },
      ],
    })

    const { wrapper, practice } = await mountView()
    const rows = wrapper.findAll('.folder-row')
    await rows[1].trigger('click')
    await flushPromises()

    expect(rows[0].classes()).not.toContain('selected')
    expect(rows[1].classes()).toContain('selected')
    expect(wrapper.get('.folder-preview-title-row').attributes('data-folder-id')).toBe('8')
    expect(archiveApi.listPractices).toHaveBeenLastCalledWith(8, { page: 0, sort: 'latest' })

    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()
    expect(practice.folderId).toBe('8')
  })

  test('limits a new folder name to 20 characters and shows its length', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('.folder-mode-tabs button:last-child').trigger('click')

    const name = wrapper.get('#newFolderName')
    expect(name.attributes('maxlength')).toBe('20')
    await name.setValue('발표 폴더')
    expect(wrapper.get('[data-testid="folder-name-counter"]').text()).toBe('5/20')
  })

  test('keeps a long server folder name inside the list and exposes the original text', async () => {
    const longName = '123456789012345678901234567890'
    vi.mocked(practiceApi.listFolders).mockResolvedValue({
      folders: [{ folderId: 7, name: longName, type: 'presentation', practiceCount: 1 }],
    })

    const { wrapper } = await mountView()
    const title = wrapper.get('.folder-row strong')

    expect(title.attributes('title')).toBe(longName)
    expect(title.classes()).toContain('folder-row-title')
  })

  test('deletes the selected folder once after explicit confirmation', async () => {
    let resolveDelete
    const deleteFolder = vi.spyOn(practiceApi, 'deleteFolder').mockImplementation(() => (
      new Promise((resolve) => { resolveDelete = resolve })
    ))
    const { wrapper } = await mountView()

    expect(wrapper.get('[data-testid="folder-delete-trigger"]').text()).toBe('')
    expect(wrapper.get('[data-testid="folder-delete-trigger"] > span').attributes('aria-hidden')).toBe('true')
    await wrapper.get('[data-testid="folder-delete-trigger"]').trigger('click')
    expect(wrapper.get('[data-testid="folder-delete-dialog"]').text()).toContain('폴더를 삭제하시겠습니까?')
    expect(wrapper.get('[data-testid="folder-delete-dialog"]').text()).toContain('관련 리포트도 모두 삭제됩니다.')

    const confirm = wrapper.get('[data-testid="confirm-folder-delete"]')
    await confirm.trigger('click')
    await confirm.trigger('click')
    expect(deleteFolder).toHaveBeenCalledTimes(1)
    expect(confirm.attributes('disabled')).toBeDefined()

    resolveDelete({})
    await flushPromises()
    expect(wrapper.find('[data-testid="folder-delete-dialog"]').exists()).toBe(false)
    expect(wrapper.find('.folder-row').exists()).toBe(false)
  })
})
