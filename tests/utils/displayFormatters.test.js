import { describe, expect, it } from 'vitest'

import {
  formatCount,
  formatDecimal,
  formatScore,
  formatWordsPerSecond,
  formatWpm,
} from '../../src/utils/displayFormatters.js'

describe('display formatters', () => {
  it('limits decimals to one place and removes a trailing zero', () => {
    expect(formatDecimal(33.33333206176758)).toBe('33.3')
    expect(formatDecimal(14.8)).toBe('14.8')
    expect(formatDecimal(100)).toBe('100')
  })

  it('rejects invalid score values and rounds valid scores', () => {
    expect(formatScore(91.49)).toBe('91')
    expect(formatScore(108)).toBe('-')
    expect(formatScore(Number.POSITIVE_INFINITY)).toBe('-')
  })

  it('uses integer counts and guarded WPM values', () => {
    expect(formatCount(2.7)).toBe('3')
    expect(formatCount(-1)).toBe('-')
    expect(formatWpm(137.4289)).toBe('137.4 WPM')
    expect(formatWpm('not-a-number')).toBe('-')
  })

  it('converts WPM to words per second with a consistent two-decimal label', () => {
    expect(formatWordsPerSecond(42)).toBe('\uCD08\uB2F9 0.70\uC5B4\uC808')
    expect(formatWordsPerSecond(672)).toBe('\uCD08\uB2F9 11.20\uC5B4\uC808')
    expect(formatWordsPerSecond('not-a-number')).toBe('-')
  })
})
