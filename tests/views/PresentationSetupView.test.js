import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { practiceApi } from '../../src/api/practiceApi.js'
import { presentationApi } from '../../src/api/presentationApi.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import PresentationSetupView from '../../src/views/presentation/PresentationSetupView.vue'

const mountSetup = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/practice/folders', component: { template: '<div data-testid="folder-page" />' } },
      { path: '/presentation/setup', component: PresentationSetupView },
      { path: '/presentation/slides', component: { template: '<div />' } },
    ],
  })
  await router.push('/presentation/setup')
  await router.isReady()
  return { pinia, router }
}

const mountRoutedSetup = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/practice/folders', component: { template: '<div data-testid="folder-page" />' } },
      { path: '/presentation/setup', component: PresentationSetupView },
      { path: '/presentation/slides', component: { template: '<div data-testid="slides-page" />' } },
    ],
  })
  await router.push('/practice/folders?type=presentation')
  await router.push('/presentation/setup')
  await router.isReady()

  const wrapper = mount(RouterView, { global: { plugins: [pinia, router] } })
  return { pinia, router, wrapper }
}

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

// 기존 자료 선택 모달은 <Teleport to="body">로 붙으므로 wrapper 대신 document에서 찾는다.
const modal = (selector) => document.body.querySelector(selector)
const modalAll = (selector) => [...document.body.querySelectorAll(selector)]

describe('PresentationSetupView', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('uses defensive practice title and description limits with counters', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/presentation/setup', component: PresentationSetupView }],
    })
    await router.push('/presentation/setup')
    await router.isReady()

    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })

    expect(wrapper.get('#title').attributes('maxlength')).toBe('15')
    expect(wrapper.get('#description').attributes('maxlength')).toBe('100')
    expect(wrapper.get('[data-testid="presentation-title-counter"]').text()).toBe('0/15')
    expect(wrapper.get('[data-testid="presentation-description-counter"]').text()).toBe('0/100')
  })

  test('removes emoji pasted into the presentation practice title', async () => {
    const { pinia, router } = await mountSetup()
    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })

    await wrapper.get('#title').setValue('서비스 소개 😁')

    expect(wrapper.get('#title').element.value).toBe('서비스 소개 ')
    expect(wrapper.get('[data-testid="presentation-title-counter"]').text()).toBe('7/15')
  })

  test('shows the 50MB limit without an upload-waiting label after file selection', async () => {
    const { pinia, router } = await mountSetup()
    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['pdf'], 'deck.pdf', { type: 'application/pdf' })],
    })

    await input.trigger('change')

    expect(wrapper.get('#uploadHelp').text()).toContain('최대 50MB')
    expect(wrapper.text()).not.toContain('업로드 대기')
  })

  test('clamps directly entered target minutes to the 1..30 range', async () => {
    const { pinia, router } = await mountSetup()
    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })
    const input = wrapper.get('#durationInput')

    expect(input.attributes('max')).toBe('30')

    await input.setValue('31')
    expect(input.element.value).toBe('30')

    await input.setValue('0')
    expect(input.element.value).toBe('1')

    await input.setValue('30')
    await wrapper.get('[aria-label="목표 시간 1분 늘리기"]').trigger('click')
    expect(input.element.value).toBe('30')
  })

  test('requires the description that Spring validates with @NotBlank', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/presentation/setup', component: PresentationSetupView },
        { path: '/presentation/slides', component: { template: '<div />' } },
      ],
    })
    await router.push('/presentation/setup')
    await router.isReady()

    const presentation = usePresentationStore()
    presentation.stagePresentationFile(
      new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }),
    )
    vi.spyOn(presentation, 'uploadPresentation').mockResolvedValue([])

    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })
    await wrapper.get('#title').setValue('API 발표')

    expect(wrapper.get('label[for="description"]').text()).not.toContain('선택')
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeDefined()

    await wrapper.get('#description').setValue('Spring 계약에 맞춘 발표 연습')
    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    expect(presentation.setDescription).toBeDefined()
    expect(presentation.description).toBe('Spring 계약에 맞춘 발표 연습')
    expect(router.currentRoute.value.path).toBe('/presentation/slides')
  })

  // 같은 폴더에 쌓인 발표 자료는 파일을 다시 올리지 않고 골라 쓸 수 있어야 한다.
  test('reuses a previous deck from the same folder instead of uploading a file', async () => {
    const { pinia, router } = await mountSetup()

    const practice = usePracticeStore()
    practice.setFolder({ id: '7', name: 'QA 폴더' })

    vi.spyOn(practiceApi, 'listPresentationPractices').mockResolvedValue({
      practices: [
        {
          practiceId: 11,
          presentationId: 21,
          title: '1차 발표',
          description: '초안 리허설',
          durationSec: 300,
          createdAt: '2026-08-01T10:00:00',
        },
      ],
    })
    const reuse = vi.spyOn(presentationApi, 'reuse').mockResolvedValue({
      presentationId: 99,
      practiceId: 100,
      status: 'COMPLETED',
    })

    const presentation = usePresentationStore()
    vi.spyOn(presentation, 'ensureSlidesLoaded').mockResolvedValue([])
    vi.spyOn(presentationApi, 'getSlides').mockResolvedValue({
      slides: [{ slideId: 1, slideNumber: 1, imageUrl: 'https://cdn/1.png' }],
    })

    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })
    await wrapper.get('#title').setValue('재사용 발표')
    await wrapper.get('#description').setValue('이전 자료 그대로 다시 연습')

    await wrapper.get('[data-testid="open-reuse-picker"]').trigger('click')
    await flushPromises()

    const options = modalAll('[data-testid="reuse-material-option"]')
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain('1차 발표')

    options[0].click()
    await flushPromises()

    expect(wrapper.get('[data-testid="reused-material"]').text()).toContain('1차 발표')
    // 파일 없이도 다음 단계로 넘어갈 수 있어야 한다.
    expect(wrapper.get('.workflow-side-next').attributes('disabled')).toBeUndefined()

    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    expect(reuse).toHaveBeenCalledWith(expect.objectContaining({
      folderId: 7,
      sourcePresentationId: 21,
      title: '재사용 발표',
      description: '이전 자료 그대로 다시 연습',
    }))
    expect(presentation.sessionId).toBe(99)
    expect(router.currentRoute.value.path).toBe('/presentation/slides')
  })

  test('tells the user when the folder has no reusable deck yet', async () => {
    const { pinia, router } = await mountSetup()
    usePracticeStore().setFolder({ id: '7', name: 'QA 폴더' })
    vi.spyOn(practiceApi, 'listPresentationPractices').mockResolvedValue({ practices: [] })

    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })
    await wrapper.get('[data-testid="open-reuse-picker"]').trigger('click')
    await flushPromises()

    expect(modal('[data-testid="reuse-empty"]').textContent).toContain('재사용할 발표 자료가 없어요')
  })

  test('현재 발표와 중복된 presentationId는 기존 자료 목록에서 한 번도 보여주지 않는다', async () => {
    const { pinia, router } = await mountSetup()
    usePracticeStore().setFolder({ id: '7', name: 'QA 폴더' })
    const presentation = usePresentationStore()
    presentation.sessionId = 21
    vi.spyOn(practiceApi, 'listPresentationPractices').mockResolvedValue({
      practices: [
        { practiceId: 11, presentationId: 21, title: '현재 발표' },
        { practiceId: 12, presentationId: 31, title: '재사용 후보' },
        { practiceId: 12, presentationId: 31, title: '재사용 후보 중복 응답' },
      ],
    })

    const wrapper = mount(PresentationSetupView, { global: { plugins: [pinia, router] } })
    await wrapper.get('[data-testid="open-reuse-picker"]').trigger('click')
    await flushPromises()

    const options = modalAll('[data-testid="reuse-material-option"]')
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain('재사용 후보')
    expect(options[0].textContent).not.toContain('현재 발표')
  })

  test('does not offer presentations created earlier in the current setup flow as reusable material', async () => {
    await mountSetup()
    usePracticeStore().setFolder({ id: '7', name: 'QA 폴더' })
    const presentation = usePresentationStore()

    vi.spyOn(presentationApi, 'create').mockResolvedValue({
      presentationId: 21,
      practiceId: 31,
      status: 'COMPLETED',
    })
    vi.spyOn(presentationApi, 'getStatus').mockResolvedValue({ processingStatus: 'COMPLETED' })
    vi.spyOn(presentationApi, 'getSlides').mockResolvedValue({
      slides: [{ slideId: 1, slideNumber: 1, imageUrl: 'https://cdn/current.png' }],
    })
    vi.spyOn(presentationApi, 'reuse').mockResolvedValue({
      presentationId: 41,
      practiceId: 51,
      status: 'COMPLETED',
    })
    const listMaterials = vi.spyOn(practiceApi, 'listPresentationPractices')

    presentation.setTitle('새 발표')
    presentation.setDescription('새 발표 설명')
    await presentation.uploadPresentation(
      new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }),
      { pollIntervalMs: 0, maxAttempts: 1 },
    )
    presentation.selectReusableMaterial({ presentationId: 11, title: '이전에 완료된 자료' })
    await presentation.reusePresentation()

    listMaterials.mockResolvedValue({
      practices: [
        { practiceId: 31, presentationId: 21, title: '방금 업로드한 자료' },
        { practiceId: 10, presentationId: 11, title: '이전에 완료된 자료' },
        { practiceId: 51, presentationId: 41, title: '현재 재사용 발표' },
      ],
    })

    await presentation.loadReusableMaterials()

    expect(presentation.reusableMaterials.map((item) => item.presentationId)).toEqual([11])
  })

  test('does not call reuse API twice for the already applied source presentation', async () => {
    await mountSetup()
    usePracticeStore().setFolder({ id: '7', name: 'QA 폴더' })
    const presentation = usePresentationStore()
    presentation.setTitle('재사용 발표')
    presentation.setDescription('재사용 설명')
    presentation.selectReusableMaterial({ presentationId: 11, title: '기존 자료' })

    const reuse = vi.spyOn(presentationApi, 'reuse').mockResolvedValue({
      presentationId: 21,
      practiceId: 31,
      status: 'COMPLETED',
    })
    vi.spyOn(presentationApi, 'getSlides').mockResolvedValue({
      slides: [{ slideId: 1, slideNumber: 1, imageUrl: 'https://cdn/reused.png' }],
    })

    await presentation.reusePresentation()
    await presentation.reusePresentation()

    expect(reuse).toHaveBeenCalledTimes(1)
  })

  test('keeps the setup page when continuing an upload from the previous-button prompt', async () => {
    const { router, wrapper } = await mountRoutedSetup()
    const presentation = usePresentationStore()
    presentation.stagePresentationFile(new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }))
    const upload = deferred()
    vi.spyOn(presentation, 'uploadPresentation').mockReturnValue(upload.promise)

    await wrapper.get('#title').setValue('업로드 이탈 확인')
    await wrapper.get('#description').setValue('발표 자료 업로드가 끝날 때까지 기다립니다.')
    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()
    await wrapper.get('.workflow-side-prev').trigger('click')

    expect(router.currentRoute.value.path).toBe('/presentation/setup')
    expect(modal('[data-testid="presentation-upload-leave-modal"]').textContent)
      .toContain('발표 자료를 업로드 중이에요')

    modal('[data-testid="continue-presentation-upload"]').click()
    await flushPromises()

    expect(modal('[data-testid="presentation-upload-leave-modal"]')).toBeNull()
    expect(router.currentRoute.value.path).toBe('/presentation/setup')

    upload.resolve()
    await flushPromises()
  })

  test('guards browser back and does not redirect after an abandoned upload resolves', async () => {
    const { router, wrapper } = await mountRoutedSetup()
    const presentation = usePresentationStore()
    presentation.stagePresentationFile(new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }))
    const upload = deferred()
    vi.spyOn(presentation, 'uploadPresentation').mockReturnValue(upload.promise)

    await wrapper.get('#title').setValue('브라우저 뒤로가기')
    await wrapper.get('#description').setValue('업로드 중 브라우저 이동을 확인합니다.')
    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    router.back()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/setup')
    expect(modal('[data-testid="presentation-upload-leave-modal"]')).not.toBeNull()

    modal('[data-testid="leave-presentation-upload"]').click()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/practice/folders')

    upload.resolve()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/practice/folders')
  })
})
