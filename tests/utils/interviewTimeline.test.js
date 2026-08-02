import { describe, expect, test } from 'vitest'

import { questionIndexAtTime } from '../../src/utils/interviewTimeline.js'

describe('questionIndexAtTime', () => {
  const questions = [
    { durationSec: 10 },
    { durationSec: 20 },
    { durationSec: 15 },
  ]

  test('returns the question containing the current absolute video time', () => {
    expect(questionIndexAtTime(questions, 0)).toBe(0)
    expect(questionIndexAtTime(questions, 9.9)).toBe(0)
    expect(questionIndexAtTime(questions, 10)).toBe(1)
    expect(questionIndexAtTime(questions, 29.9)).toBe(1)
    expect(questionIndexAtTime(questions, 30)).toBe(2)
  })

  test('clamps times outside the recording to the first or last question', () => {
    expect(questionIndexAtTime(questions, -5)).toBe(0)
    expect(questionIndexAtTime(questions, 999)).toBe(2)
    expect(questionIndexAtTime([], 10)).toBe(0)
  })
})
