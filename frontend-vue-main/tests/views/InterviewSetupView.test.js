import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { afterEach, expect, test, vi } from 'vitest'

import { clearAccessToken, setAccessToken } from '../../src/api/authToken.js'
import { useInterviewStore } from '../../src/stores/interviewStore.js'
import InterviewSetupView from '../../src/views/interview/InterviewSetupView.vue'

afterEach(() => {
  clearAccessToken()
  vi.restoreAllMocks()
})

test('InterviewSetupView uses the shared practice input limits', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const interview = useInterviewStore()
  vi.spyOn(interview, 'loadCompanies').mockResolvedValue([])
  vi.spyOn(interview, 'loadOccupations').mockResolvedValue([])
  vi.spyOn(interview, 'loadResumeCatalog').mockResolvedValue([])
  vi.spyOn(interview, 'loadPortfolioCatalog').mockResolvedValue([])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/interview/setup', component: InterviewSetupView },
      { path: '/interview/style', component: { template: '<div />' } },
    ],
  })
  await router.push('/interview/setup')
  await router.isReady()

  const wrapper = mount(InterviewSetupView, { global: { plugins: [pinia, router] } })

  expect(wrapper.get('#title').attributes('maxlength')).toBe('15')
  expect(wrapper.get('#description').attributes('maxlength')).toBe('100')
  expect(wrapper.get('#title').element.nextElementSibling.textContent).toContain('/15')
  expect(wrapper.get('#description').element.nextElementSibling.textContent).toContain('/100')
})

test('removes emoji pasted into the interview practice title', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const interview = useInterviewStore()
  vi.spyOn(interview, 'loadCompanies').mockResolvedValue([])
  vi.spyOn(interview, 'loadOccupations').mockResolvedValue([])
  vi.spyOn(interview, 'loadResumeCatalog').mockResolvedValue([])
  vi.spyOn(interview, 'loadPortfolioCatalog').mockResolvedValue([])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/interview/setup', component: InterviewSetupView },
      { path: '/interview/style', component: { template: '<div />' } },
    ],
  })
  await router.push('/interview/setup')
  await router.isReady()
  const wrapper = mount(InterviewSetupView, { global: { plugins: [pinia, router] } })

  await wrapper.get('#title').setValue('백엔드 면접 🇰🇷')

  expect(wrapper.get('#title').element.value).toBe('백엔드 면접 ')
})

test('rejects a non-PDF interview document before upload with a Korean message', async () => {
  setAccessToken('test-token')
  const pinia = createPinia()
  setActivePinia(pinia)
  const interview = useInterviewStore()
  vi.spyOn(interview, 'loadCompanies').mockResolvedValue([])
  vi.spyOn(interview, 'loadOccupations').mockResolvedValue([])
  vi.spyOn(interview, 'loadResumeCatalog').mockResolvedValue([])
  vi.spyOn(interview, 'loadPortfolioCatalog').mockResolvedValue([])
  const uploadResume = vi.spyOn(interview, 'uploadResumeDoc').mockResolvedValue(undefined)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/interview/setup', component: InterviewSetupView },
      { path: '/interview/style', component: { template: '<div />' } },
    ],
  })
  await router.push('/interview/setup')
  await router.isReady()
  const wrapper = mount(InterviewSetupView, { global: { plugins: [pinia, router] } })
  await flushPromises()

  const realCreateElement = document.createElement.bind(document)
  const fileInput = realCreateElement('input')
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [new File(['word'], 'resume.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })],
  })
  vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => (
    tagName === 'input' ? fileInput : realCreateElement(tagName, options)
  ))
  const prompt = vi.spyOn(window, 'prompt')

  await wrapper.findAll('.iv-doc-choice')[1].trigger('click')
  expect(fileInput.accept).toBe('.pdf,application/pdf')
  fileInput.dispatchEvent(new Event('change'))
  await flushPromises()

  expect(wrapper.text()).toContain('PDF 파일만 등록할 수 있습니다.')
  expect(prompt).not.toHaveBeenCalled()
  expect(uploadResume).not.toHaveBeenCalled()
})

test('shows the 50MB limit on the right side of both interview upload buttons', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const interview = useInterviewStore()
  vi.spyOn(interview, 'loadCompanies').mockResolvedValue([])
  vi.spyOn(interview, 'loadOccupations').mockResolvedValue([])
  vi.spyOn(interview, 'loadResumeCatalog').mockResolvedValue([])
  vi.spyOn(interview, 'loadPortfolioCatalog').mockResolvedValue([])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/interview/setup', component: InterviewSetupView },
      { path: '/interview/style', component: { template: '<div />' } },
    ],
  })
  await router.push('/interview/setup')
  await router.isReady()

  const wrapper = mount(InterviewSetupView, { global: { plugins: [pinia, router] } })

  expect(wrapper.get('[data-testid="resume-upload-limit"]').text()).toBe('최대 50MB')
  expect(wrapper.get('[data-testid="portfolio-upload-limit"]').text()).toBe('최대 50MB')
  expect(wrapper.findAll('.iv-doc-choice')[0].text()).not.toContain('최대 50MB')
})

test('rejects an interview document over 50MB before asking for a title or uploading', async () => {
  setAccessToken('test-token')
  const pinia = createPinia()
  setActivePinia(pinia)
  const interview = useInterviewStore()
  vi.spyOn(interview, 'loadCompanies').mockResolvedValue([])
  vi.spyOn(interview, 'loadOccupations').mockResolvedValue([])
  vi.spyOn(interview, 'loadResumeCatalog').mockResolvedValue([])
  vi.spyOn(interview, 'loadPortfolioCatalog').mockResolvedValue([])
  const uploadResume = vi.spyOn(interview, 'uploadResumeDoc').mockResolvedValue(undefined)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/interview/setup', component: InterviewSetupView },
      { path: '/interview/style', component: { template: '<div />' } },
    ],
  })
  await router.push('/interview/setup')
  await router.isReady()
  const wrapper = mount(InterviewSetupView, { global: { plugins: [pinia, router] } })
  await flushPromises()

  const oversizedPdf = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })
  Object.defineProperty(oversizedPdf, 'size', {
    configurable: true,
    value: 50 * 1024 * 1024 + 1,
  })
  const realCreateElement = document.createElement.bind(document)
  const fileInput = realCreateElement('input')
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [oversizedPdf],
  })
  vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => (
    tagName === 'input' ? fileInput : realCreateElement(tagName, options)
  ))
  const prompt = vi.spyOn(window, 'prompt').mockReturnValue('자기소개서')

  await wrapper.findAll('.iv-doc-choice')[1].trigger('click')
  fileInput.dispatchEvent(new Event('change'))
  await flushPromises()

  expect(wrapper.text()).toContain('PDF 파일은 50MB 이하여야 합니다.')
  expect(prompt).not.toHaveBeenCalled()
  expect(uploadResume).not.toHaveBeenCalled()
})
