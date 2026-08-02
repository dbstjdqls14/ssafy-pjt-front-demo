import { describe, expect, it } from 'vitest'

import { normalizeReportScoreCards, toReportScore } from '../../src/utils/interviewReportScores.js'

describe('interview report scores', () => {
  it('keeps backend scores including values below 60 and zero', () => {
    expect(toReportScore(0, 84)).toBe(0)
    expect(toReportScore(37, 84)).toBe(37)
    expect(toReportScore(100, 84)).toBe(100)
  })

  it('uses backend score cards and their metric values first', () => {
    const fallback = [{ label: '목업', value: 84, title: '목업', rows: [] }]
    const cards = normalizeReportScoreCards([
      {
        score: 42,
        label: '음성',
        metrics: [
          { label: '필러', value: '7회' },
          { label: '말 속도', value: 3.2 },
        ],
      },
    ], fallback)

    expect(cards).toEqual([
      {
        label: '음성',
        value: 42,
        title: '음성',
        rows: [['필러', '7회'], ['말 속도', 3.2]],
      },
    ])
  })

  it('uses the caller-provided empty state when backend score cards are absent', () => {
    const fallback = []

    expect(normalizeReportScoreCards(undefined, fallback)).toBe(fallback)
    expect(normalizeReportScoreCards([], fallback)).toBe(fallback)
  })
})
