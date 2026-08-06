import { describe, expect, test, vi } from 'vitest'

import { useActionInterlock } from '../../src/composables/useActionInterlock.js'

describe('useActionInterlock', () => {
  test('실행 중인 명령과 완료 직후 재클릭을 차단한다', async () => {
    vi.useFakeTimers()
    const gate = useActionInterlock({ cooldownMs: 1_000 })
    let resolveAction
    const action = vi.fn(() => new Promise((resolve) => { resolveAction = resolve }))

    const first = gate.runExclusive('advance', action)
    const blockedWhilePending = await gate.runExclusive('advance', action)

    expect(blockedWhilePending).toBeUndefined()
    expect(gate.pendingAction.value).toBe('advance')
    expect(action).toHaveBeenCalledTimes(1)

    resolveAction('done')
    await expect(first).resolves.toBe('done')
    expect(gate.isCoolingDown.value).toBe(true)

    const blockedDuringCooldown = await gate.runExclusive('advance', action)
    expect(blockedDuringCooldown).toBeUndefined()
    expect(action).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)
    const second = gate.runExclusive('advance', () => 'again')
    await expect(second).resolves.toBe('again')

    gate.dispose()
    vi.useRealTimers()
  })

  test('실패한 명령도 잠금을 해제하고 cooldown을 적용한다', async () => {
    vi.useFakeTimers()
    const gate = useActionInterlock({ cooldownMs: 500 })

    await expect(gate.runExclusive('finish', async () => {
      throw new Error('failed')
    })).rejects.toThrow('failed')

    expect(gate.pendingAction.value).toBeNull()
    expect(gate.isCoolingDown.value).toBe(true)

    await vi.advanceTimersByTimeAsync(500)
    expect(gate.isLocked.value).toBe(false)

    gate.dispose()
    vi.useRealTimers()
  })

  test('dispose가 예약된 cooldown을 즉시 정리한다', async () => {
    vi.useFakeTimers()
    const gate = useActionInterlock({ cooldownMs: 1_000 })

    await gate.runExclusive('save', async () => 'saved')
    gate.dispose()

    expect(gate.pendingAction.value).toBeNull()
    expect(gate.isCoolingDown.value).toBe(false)
    expect(gate.isLocked.value).toBe(false)

    vi.useRealTimers()
  })
})
