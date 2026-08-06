import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedCallback } from '../../src/composables/useDebouncedCallback.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedCallback', () => {
  it('runs only the latest scheduled call after the delay', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const { schedule } = useDebouncedCallback(callback, 250)

    schedule('first')
    schedule('latest')
    vi.advanceTimersByTime(249)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('latest')
  })

  it('cancels pending work when its Vue effect scope is disposed', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const scope = effectScope()
    let schedule

    scope.run(() => {
      ;({ schedule } = useDebouncedCallback(callback, 250))
    })
    schedule()
    scope.stop()
    vi.runAllTimers()

    expect(callback).not.toHaveBeenCalled()
  })
})
