import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useDocumentsStore } from '../../src/stores/documentsStore.js'
import MyPageDocumentsView from '../../src/views/mypage/MyPageDocumentsView.vue'

const mountView = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useDocumentsStore()
  vi.spyOn(store, 'loadDocuments').mockResolvedValue([])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/mypage/documents', name: 'mypage-documents', component: MyPageDocumentsView },
      { path: '/mypage/documents/:id', name: 'mypage-document-detail', component: { template: '<div />' } },
    ],
  })
  await router.push('/mypage/documents')
  await router.isReady()
  const wrapper = mount(MyPageDocumentsView, {
    attachTo: document.body,
    global: { plugins: [pinia, router], stubs: { Teleport: true } },
  })
  await flushPromises()
  return { wrapper, store }
}

describe('MyPageDocumentsView registration', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => { document.body.innerHTML = '' })

  test('selects a document type and uploads an explicitly titled PDF', async () => {
    const { wrapper, store } = await mountView()
    const upload = vi.spyOn(store, 'uploadDocument').mockResolvedValue({ id: 'resume:31' })
    const file = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })

    await wrapper.get('[data-testid="open-document-registration"]').trigger('click')
    expect(wrapper.get('[data-testid="document-type-step"]').text()).toContain('자료 유형')
    await wrapper.get('[data-document-type="resume"]').trigger('click')
    expect(wrapper.get('[data-testid="document-title"]').attributes('maxlength')).toBe('50')
    await wrapper.get('[data-testid="document-title"]').setValue('백엔드 개발자 자소서')
    const input = wrapper.get('[data-testid="document-file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await wrapper.get('[data-testid="submit-document"]').trigger('submit')
    await flushPromises()

    expect(upload).toHaveBeenCalledWith({ type: 'resume', title: '백엔드 개발자 자소서', file })
    expect(wrapper.find('[data-testid="document-registration-modal"]').exists()).toBe(false)
  })

  test('rejects an empty title and non-PDF without calling the store', async () => {
    const { wrapper, store } = await mountView()
    const upload = vi.spyOn(store, 'uploadDocument')
    const file = new File(['text'], 'resume.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

    await wrapper.get('[data-testid="open-document-registration"]').trigger('click')
    await wrapper.get('[data-document-type="portfolio"]').trigger('click')
    const input = wrapper.get('[data-testid="document-file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await wrapper.get('[data-testid="submit-document"]').trigger('submit')

    expect(wrapper.get('[data-testid="document-form-error"]').text()).toContain('제목')
    expect(upload).not.toHaveBeenCalled()
  })

  test('shows and enforces the 50MB PDF limit before calling the store', async () => {
    const { wrapper, store } = await mountView()
    const upload = vi.spyOn(store, 'uploadDocument')
    const file = new File(['pdf'], 'oversized.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { configurable: true, value: 50 * 1024 * 1024 + 1 })

    await wrapper.get('[data-testid="open-document-registration"]').trigger('click')
    await wrapper.get('[data-document-type="resume"]').trigger('click')
    expect(wrapper.get('[data-testid="document-file-help"]').text()).toContain('최대 50MB')
    await wrapper.get('[data-testid="document-title"]').setValue('대용량 자소서')
    const input = wrapper.get('[data-testid="document-file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await wrapper.get('[data-testid="submit-document"]').trigger('submit')

    expect(wrapper.get('[data-testid="document-form-error"]').text()).toContain('50MB')
    expect(upload).not.toHaveBeenCalled()
  })

  test('keeps registration input for retry when upload fails', async () => {
    const { wrapper, store } = await mountView()
    vi.spyOn(store, 'uploadDocument').mockRejectedValue(new Error('upload failed'))
    const file = new File(['pdf'], 'portfolio.pdf', { type: 'application/pdf' })

    await wrapper.get('[data-testid="open-document-registration"]').trigger('click')
    await wrapper.get('[data-document-type="portfolio"]').trigger('click')
    await wrapper.get('[data-testid="document-title"]').setValue('AIVO 포트폴리오')
    const input = wrapper.get('[data-testid="document-file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await wrapper.get('[data-testid="submit-document"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="document-registration-modal"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="document-title"]').element.value).toBe('AIVO 포트폴리오')
    expect(wrapper.get('[data-testid="document-form-error"]').text()).toContain('등록하지 못했습니다')
  })

  test('shows a retry action for list failures and omits unavailable file sizes', async () => {
    const { wrapper, store } = await mountView()
    store.resumes = [{ id: 1, title: '자소서', createdAt: '2026-07-20T00:00:00' }]
    store.error = '지원 자료를 불러오지 못했습니다.'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('MB')
    await wrapper.get('[data-testid="retry-documents"]').trigger('click')
    expect(store.loadDocuments).toHaveBeenCalledTimes(2)
  })

  test('protects long document and selected file names without changing the original text', async () => {
    const { wrapper, store } = await mountView()
    const longTitle = '자소서'.repeat(30)
    store.resumes = [{ id: 1, title: longTitle, createdAt: '2026-07-20T00:00:00' }]
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.doc-card-title').attributes('title')).toBe(longTitle)

    await wrapper.get('[data-testid="open-document-registration"]').trigger('click')
    await wrapper.get('[data-document-type="resume"]').trigger('click')
    const longFileName = `${'portfolio-'.repeat(20)}.pdf`
    const file = new File(['pdf'], longFileName, { type: 'application/pdf' })
    const input = wrapper.get('[data-testid="document-file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')

    expect(wrapper.get('.doc-file-name').attributes('title')).toBe(longFileName)
  })
})
