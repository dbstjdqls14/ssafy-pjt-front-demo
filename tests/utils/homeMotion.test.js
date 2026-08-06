import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useHomeMotion } from '../../src/composables/useHomeMotion.js'

class IntersectionObserverStub {
  observe() {}
  disconnect() {}
}

const MotionHost = {
  setup() {
    useHomeMotion()
    return () => h('main', [
      h('section', {
        id: 'home',
        'data-home-section': '01',
        'data-theme': 'light',
      }),
    ])
  },
}

describe('home motion scrolling', () => {
  let animationFrames

  beforeEach(() => {
    animationFrames = []
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      animationFrames.push(callback)
      return animationFrames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 4000 })
    vi.spyOn(window, 'scrollTo').mockImplementation((left, top) => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: Math.round(Number(top)) })
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('keeps cinematic wheel easing in one animation-frame loop', async () => {
    const wrapper = mount(MotionHost, { attachTo: document.body })
    await nextTick()

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 120,
      cancelable: true,
    })
    window.dispatchEvent(wheelEvent)

    expect(wheelEvent.defaultPrevented).toBe(true)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

    let frameCount = 0
    while (animationFrames.length && frameCount < 100) {
      animationFrames.shift()()
      frameCount += 1
    }

    expect(window.scrollTo).toHaveBeenCalled()
    // Desktop wheel input is intentionally reduced so section motion remains
    // visible instead of racing toward the next section.
    expect(window.scrollY).toBeCloseTo(104, 0)
    expect(document.documentElement.classList.contains('is-inertial-scrolling')).toBe(false)
    wrapper.unmount()
  })

  test('uses native scrolling on mobile', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query) => ({
      matches: query.includes('max-width'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    const wrapper = mount(MotionHost, { attachTo: document.body })
    await nextTick()

    const wheelEvent = new WheelEvent('wheel', { deltaY: 120, cancelable: true })
    window.dispatchEvent(wheelEvent)

    expect(wheelEvent.defaultPrevented).toBe(false)
    expect(window.scrollTo).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('uses elapsed time when animation frames are throttled', async () => {
    const wrapper = mount(MotionHost, { attachTo: document.body })
    await nextTick()

    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, cancelable: true }))

    animationFrames.shift()(0)
    const firstFrameY = window.scrollY
    animationFrames.shift()(1000)
    const catchUpFrameY = window.scrollY
    animationFrames.shift()(2000)

    expect(firstFrameY).toBeLessThan(10)
    expect(catchUpFrameY).toBeGreaterThan(60)
    expect(document.documentElement.classList.contains('is-inertial-scrolling')).toBe(false)
    wrapper.unmount()
  })

  test('caps a burst of wheel input below one viewport', async () => {
    const wrapper = mount(MotionHost, { attachTo: document.body })
    await nextTick()

    for (let index = 0; index < 20; index += 1) {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 160, cancelable: true }))
    }

    let frameCount = 0
    while (animationFrames.length && frameCount < 200) {
      animationFrames.shift()()
      frameCount += 1
    }

    expect(window.scrollY).toBeLessThanOrEqual(680)
    expect(document.documentElement.classList.contains('is-inertial-scrolling')).toBe(false)
    wrapper.unmount()
  })
})
