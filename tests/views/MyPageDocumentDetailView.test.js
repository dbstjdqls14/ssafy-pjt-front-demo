import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useDocumentsStore } from '../../src/stores/documentsStore.js'
import MyPageDocumentDetailView from '../../src/views/mypage/MyPageDocumentDetailView.vue'

const mountView = async (item, id = item?.id ?? 'resume:1') => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useDocumentsStore()
  const loadDocument = vi.spyOn(store, 'loadDocument').mockResolvedValue(item)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/mypage/documents', name: 'mypage-documents', component: { template: '<div>목록</div>' } },
      { path: '/mypage/documents/:id', name: 'mypage-document-detail', component: MyPageDocumentDetailView },
    ],
  })
  await router.push(`/mypage/documents/${id}`)
  await router.isReady()
  const wrapper = mount(MyPageDocumentDetailView, {
    attachTo: document.body,
    global: { plugins: [pinia, router], stubs: { Teleport: true } },
  })
  await flushPromises()
  return { wrapper, store, router, loadDocument }
}

describe('MyPageDocumentDetailView', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => { document.body.innerHTML = '' })

  test('renders extracted resume content without a fake preview or download control', async () => {
    const item = {
      id: 'resume:3',
      type: 'resume',
      name: '개발자 자소서',
      date: '2026.07.20',
      content: '지원 동기와 프로젝트 경험입니다.',
    }
    const { wrapper, loadDocument } = await mountView(item)

    expect(loadDocument).toHaveBeenCalledWith('resume:3')
    expect(wrapper.get('[data-testid="document-extracted-content"]').text()).toContain(item.content)
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('새 창에서 열기')
  })

  test('renders the server portfolio summary', async () => {
    const item = {
      id: 'portfolio:8',
      type: 'portfolio',
      name: 'AIVO 포트폴리오',
      date: '2026.07.22',
      summary: '발표 및 면접 코칭 프로젝트를 정리했습니다.',
    }
    const { wrapper } = await mountView(item)

    expect(wrapper.get('[data-testid="document-extracted-content"]').text()).toContain(item.summary)
    expect(wrapper.text()).toContain('포트폴리오 요약')
  })

  test('keeps a long server title and extracted body inside the detail card', async () => {
    const item = {
      id: 'resume:9',
      type: 'resume',
      name: '공백없는아주긴자료제목'.repeat(20),
      date: '2026.08.03',
      content: '공백없는아주긴추출본문'.repeat(80),
    }
    const { wrapper } = await mountView(item)

    expect(wrapper.get('.document-detail-card h2').attributes('title')).toBe(item.name)
    expect(wrapper.get('.document-content p').classes()).toContain('is-breakable')
  })

  test('shows a clear empty state when the API has no matching document', async () => {
    const { wrapper } = await mountView(null, 'resume:404')

    expect(wrapper.get('[data-testid="document-not-found"]').text()).toContain('찾을 수 없어요')
  })

  test('deletes by composite id and returns to the document list', async () => {
    const item = { id: 'resume:7', type: 'resume', name: '삭제할 자소서', date: '2026.07.20', content: '본문' }
    const { wrapper, store, router } = await mountView(item)
    const remove = vi.spyOn(store, 'removeDocument').mockResolvedValue(true)

    await wrapper.get('[data-testid="open-detail-delete"]').trigger('click')
    await wrapper.get('[data-testid="confirm-detail-delete"]').trigger('click')
    await flushPromises()

    expect(remove).toHaveBeenCalledWith('resume:7')
    expect(router.currentRoute.value.name).toBe('mypage-documents')
  })
})
