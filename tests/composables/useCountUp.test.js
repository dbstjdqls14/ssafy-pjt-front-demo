import { computed, effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCountUp } from '../../src/composables/useCountUp.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('useCountUp', () => {
  it('counts to the resolved target without leaving an overshoot', () => {
    vi.useFakeTimers()
    const target = ref(85)
    const { value, start } = useCountUp(computed(() => target.value), { step: 2, interval: 24 })

    start()
    vi.runAllTimers()

    expect(value.value).toBe(85)
  })

  it('stops its interval when the owning Vue scope is disposed', () => {
    vi.useFakeTimers()
    const scope = effectScope()
    let counter

    scope.run(() => {
      counter = useCountUp(100, { step: 2, interval: 24 })
      counter.start()
    })
    vi.advanceTimersByTime(24)
    expect(counter.value.value).toBe(2)

    scope.stop()
    vi.runAllTimers()
    expect(counter.value.value).toBe(2)
  })
})
