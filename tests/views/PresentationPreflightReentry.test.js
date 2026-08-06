import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import PresentationReadyView from '../../src/views/presentation/PresentationReadyView.vue'
import PresentationSetupView from '../../src/views/presentation/PresentationSetupView.vue'
import PresentationSlidesView from '../../src/views/presentation/PresentationSlidesView.vue'
import { usePresentationStore } from '../../src/stores/presentationStore.js'

const routes = [
  { path: '/', component: { template: '<div />' } },
  { path: '/practice/folders', component: { template: '<div />' } },
  { path: '/presentation/setup', component: PresentationSetupView },
  { path: '/presentation/slides', component: PresentationSlidesView },
  { path: '/presentation/check', component: { template: '<div />' } },
  { path: '/presentation/ready', component: { template: '<div />' } },
  { path: '/presentation/record', component: { template: '<div />' } },
]

const seedSlides = (store) => {
  store.uploadStatus = 'ready'
  store.setSlides([
    { slideId: 'slide-1', title: '팀 소개', imageUrl: '/converted/slide-1.png', keyPoints: '강점 설명' },
    { slideId: 'slide-2', title: '구조', imageUrl: '/converted/slide-2.png', keyPoints: '구조 설명' },
  ])
}

const mountAt = async (component, path) => {
  setActivePinia(createPinia())
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const store = usePresentationStore()
  seedSlides(store)
  const wrapper = mount(component, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, store, router }
}

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

const originalPermissions = navigator.permissions
afterEach(() => {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: originalPermissions,
  })
})

describe('설정 확인을 이미 통과한 연습으로 다시 들어올 때', () => {
  test('첫 진입 체크는 화면, 오디오, PPT 순서로만 완료된다', async () => {
    vi.useFakeTimers()
    try {
      const { wrapper } = await mountAt(PresentationReadyView, '/presentation/ready')
      const doneState = () => wrapper.findAll('.ready-item').map((item) => item.classes().includes('done'))

      expect(doneState()).toEqual([false, false, false, false])

      await vi.advanceTimersByTimeAsync(760)
      expect(doneState()).toEqual([true, false, false, false])

      await vi.advanceTimersByTimeAsync(760)
      expect(doneState()).toEqual([true, true, false, false])

      await vi.advanceTimersByTimeAsync(760)
      expect(doneState()).toEqual([true, true, true, false])
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  test('카메라 권한만 차단되면 화면 체크와 발표 시작만 잠근다', async () => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn(async ({ name }) => ({
          state: name === 'camera' ? 'denied' : 'granted',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      },
    })
    vi.useFakeTimers()
    try {
      const { wrapper } = await mountAt(PresentationReadyView, '/presentation/ready')
      await vi.advanceTimersByTimeAsync(2_280)

      const doneState = wrapper.findAll('.ready-item').map((item) => item.classes().includes('done'))
      expect(doneState).toEqual([false, true, true, false])
      expect(wrapper.text()).toContain('카메라 권한이 필요합니다')
      expect(wrapper.get('.ready-start-button').attributes('disabled')).toBeDefined()
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  test('체크 애니메이션 없이 바로 발표 시작을 열어 준다', async () => {
    const { wrapper } = await mountAt(PresentationReadyView, '/presentation/ready')
    // 아직 확인을 안 끝낸 첫 진입이면 시작 버튼은 잠겨 있다.
    expect(wrapper.get('.ready-start-button').attributes('disabled')).toBeDefined()
    wrapper.unmount()

    setActivePinia(createPinia())
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/presentation/ready')
    await router.isReady()
    const store = usePresentationStore()
    seedSlides(store)
    store.setPreflightDone(true)
    const revisit = mount(PresentationReadyView, { global: { plugins: [router] } })
    await flushPromises()

    expect(revisit.get('.ready-start-button').attributes('disabled')).toBeUndefined()
    // 네 항목 모두 체크 상태로 들어온다.
    expect(revisit.findAll('.ready-item.done')).toHaveLength(4)
    revisit.unmount()
  })

  test('핵심 내용 화면에서 다음을 누르면 장치 확인을 건너뛰고 설정 확인으로 간다', async () => {
    const { wrapper, store, router } = await mountAt(PresentationSlidesView, '/presentation/slides')
    vi.spyOn(store, 'saveSlideNotes').mockResolvedValue(undefined)

    store.setPreflightDone(true)
    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/ready')
    wrapper.unmount()
  })

  test('아직 장치 확인 전이면 장치 확인으로 간다', async () => {
    const { wrapper, store, router } = await mountAt(PresentationSlidesView, '/presentation/slides')
    vi.spyOn(store, 'saveSlideNotes').mockResolvedValue(undefined)

    await wrapper.get('.workflow-side-next').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/presentation/check')
    wrapper.unmount()
  })
})

describe('연습 설정 잠금', () => {
  test("'다음'을 눌러 자료를 처리하는 동안은 설정을 못 바꾼다", async () => {
    const { wrapper, store } = await mountAt(PresentationSetupView, '/presentation/setup')

    expect(wrapper.get('#title').attributes('disabled')).toBeUndefined()

    store.uploadStatus = 'processing'
    await flushPromises()

    expect(wrapper.get('[data-testid="setup-lock-note"]').exists()).toBe(true)
    expect(wrapper.get('#title').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#description').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#durationInput').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.qna-toggle').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="open-reuse-picker"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
