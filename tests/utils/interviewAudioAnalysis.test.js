import { describe, expect, test } from 'vitest'

import {
  adaptiveVoiceThreshold,
  createFillerAccumulator,
} from '../../src/utils/interviewAudioAnalysis.js'

describe('interview audio analysis guards', () => {
  test('adds distinct per-chunk filler counts once', () => {
    const accumulator = createFillerAccumulator()

    expect(accumulator.apply({ sequence: 1, fillerCount: 2 })).toBe(2)
    expect(accumulator.apply({ sequence: 1, fillerCount: 2 })).toBe(2)
    expect(accumulator.apply({ sequence: 2, fillerCount: 1 })).toBe(3)
  })

  test('uses an explicitly cumulative backend count without summing snapshots', () => {
    const accumulator = createFillerAccumulator()

    expect(accumulator.apply({ sequence: 1, fillerCount: 3, countScope: 'session' })).toBe(3)
    expect(accumulator.apply({ sequence: 2, fillerCount: 6, countScope: 'session' })).toBe(6)
    expect(accumulator.apply({ sequence: 3, totalFillerCount: 9 })).toBe(9)
    expect(accumulator.apply({ sequence: 4, totalFillerCount: 7 })).toBe(9)
  })

  test('ignores invalid and negative counts', () => {
    const accumulator = createFillerAccumulator()

    expect(accumulator.apply({ sequence: 1, fillerCount: 'not-a-number' })).toBe(0)
    expect(accumulator.apply({ sequence: 2, fillerCount: -4 })).toBe(0)
  })

  test('raises the voice threshold above a learned noise floor', () => {
    expect(adaptiveVoiceThreshold(0.004)).toBe(0.018)
    expect(adaptiveVoiceThreshold(0.012)).toBeCloseTo(0.03)
  })
})
