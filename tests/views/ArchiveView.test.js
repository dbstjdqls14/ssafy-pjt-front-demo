import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, test, vi } from 'vitest'

import { practiceApi } from '../../src/api/practiceApi.js'
import { useArchiveStore } from '../../src/stores/archiveStore.js'
import ArchiveView from '../../src/views/archive/ArchiveView.vue'

test('ArchiveView routes with the real folder id and does not fabricate scores', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const archive = useArchiveStore()
  vi.spyOn(archive, 'loadFolders').mockImplementation(async () => {
    archive.folders = [{
      id: '41',
      folderId: 41,
      name: '서비스 발표',
      type: 'presentation',
      count: 1,
      best: null,
      latestScore: null,
      description: '실제 발표 폴더',
    }]
    return archive.folders
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/archive', component: ArchiveView },
      { path: '/archive/folders/:id?', component: { template: '<div />' } },
    ],
  })
  await router.push('/archive')
  await router.isReady()
  const wrapper = mount(ArchiveView, { global: { plugins: [pinia, router] } })
  await flushPromises()

  expect(wrapper.get('[data-folder-id="41"]').text()).toContain('서비스 발표')
  expect(wrapper.text()).toContain('점수 데이터 없음')
  expect(wrapper.text()).not.toContain('0점')
  expect(wrapper.get('.archive-detail-link').attributes('href')).toBe('/archive/folders/41?type=presentation')
})

test('ArchiveView uses the archive server page without slicing it again', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const archive = useArchiveStore()
  const loadFolders = vi.spyOn(archive, 'loadFolders').mockImplementation(async ({ page }) => {
    archive.pagination = {
      totalElements: 12,
      currentPage: page,
      totalPage: 2,
      hasNext: page === 0,
    }
    archive.folders = Array.from({ length: 6 }, (_, index) => ({
      id: `${page * 6 + index + 1}`,
      folderId: page * 6 + index + 1,
      name: `서버 폴더 ${page * 6 + index + 1}`,
      type: 'presentation',
      count: 1,
      best: 90,
      latestScore: 90,
      description: '',
    }))
    return archive.folders
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/archive', component: ArchiveView },
      { path: '/archive/folders/:id?', component: { template: '<div />' } },
    ],
  })
  await router.push('/archive')
  await router.isReady()
  const wrapper = mount(ArchiveView, { global: { plugins: [pinia, router] } })
  await flushPromises()

  expect(loadFolders).toHaveBeenCalledWith({ type: undefined, keyword: undefined, page: 0 })
  expect(wrapper.text()).toContain('서버 폴더 6')

  await wrapper.findAll('.archive-page-num')[1].trigger('click')
  await flushPromises()

  expect(loadFolders).toHaveBeenLastCalledWith({ type: undefined, keyword: undefined, page: 1 })
  expect(wrapper.text()).toContain('서버 폴더 12')
})

test('ArchiveView protects long server folder names in list and detail surfaces', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const archive = useArchiveStore()
  const longName = '1234567890123456789012345678901234567890'
  vi.spyOn(archive, 'loadFolders').mockImplementation(async () => {
    archive.folders = [{
      id: '41', folderId: 41, name: longName, type: 'presentation', count: 1,
      best: 91, latestScore: 91, description: '설명'.repeat(80),
    }]
    return archive.folders
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/archive', component: ArchiveView },
      { path: '/archive/folders/:id?', component: { template: '<div />' } },
    ],
  })
  await router.push('/archive')
  await router.isReady()
  const wrapper = mount(ArchiveView, { global: { plugins: [pinia, router] } })
  await flushPromises()

  expect(wrapper.get('.archive-row-title').attributes('title')).toBe(longName)
  expect(wrapper.get('.archive-detail-title').attributes('title')).toBe(longName)
  expect(wrapper.get('.archive-detail-meta').classes()).toContain('is-breakable')
})

test('ArchiveView deletes the selected folder once after the destructive confirmation', async () => {
  let resolveDelete
  const deleteFolder = vi.spyOn(practiceApi, 'deleteFolder').mockImplementation(() => (
    new Promise((resolve) => { resolveDelete = resolve })
  ))
  const pinia = createPinia()
  setActivePinia(pinia)
  const archive = useArchiveStore()
  vi.spyOn(archive, 'loadFolders').mockImplementation(async () => {
    archive.folders = [{
      id: '41', folderId: 41, name: '삭제할 폴더', type: 'presentation', count: 1,
      best: 91, latestScore: 91, description: '삭제 확인용 폴더',
    }]
    return archive.folders
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/archive', component: ArchiveView },
      { path: '/archive/folders/:id?', component: { template: '<div />' } },
    ],
  })
  await router.push('/archive')
  await router.isReady()
  const wrapper = mount(ArchiveView, { global: { plugins: [pinia, router] } })
  await flushPromises()

  await wrapper.get('[data-testid="archive-folder-delete-trigger"]').trigger('click')
  expect(wrapper.get('[data-testid="archive-folder-delete-dialog"]').text()).toContain('폴더를 삭제하시겠습니까?')
  expect(wrapper.get('[data-testid="archive-folder-delete-dialog"]').text()).toContain('관련 리포트도 모두 삭제됩니다.')
  expect(router.currentRoute.value.path).toBe('/archive')

  const confirm = wrapper.get('[data-testid="confirm-archive-folder-delete"]')
  await confirm.trigger('click')
  await confirm.trigger('click')
  expect(deleteFolder).toHaveBeenCalledTimes(1)
  expect(deleteFolder).toHaveBeenCalledWith('41')
  expect(confirm.attributes('disabled')).toBeDefined()

  resolveDelete({})
  await flushPromises()
  expect(wrapper.find('[data-testid="archive-folder-delete-dialog"]').exists()).toBe(false)
  expect(wrapper.find('[data-folder-id="41"]').exists()).toBe(false)
})
