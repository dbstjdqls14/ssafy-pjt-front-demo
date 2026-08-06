import { describe, expect, test } from 'vitest'

import {
  SPEECH_PACE_BANDS,
  speechPaceDetail,
  speechPaceLabel,
  speechPaceLevel,
} from '../../src/utils/speechPace.js'

describe('speechPace', () => {
  test('uses 2.5 and 4.0 as the shared real-time syllable boundaries', () => {
    expect(speechPaceLevel(2.4, 'syllablesPerSecond')).toBe('slow')
    expect(speechPaceLevel(2.5, 'syllablesPerSecond')).toBe('normal')
    expect(speechPaceLevel(4.0, 'syllablesPerSecond')).toBe('normal')
    expect(speechPaceLevel(4.1, 'syllablesPerSecond')).toBe('fast')
  })

  test('WPM은 권장 범위를 기준으로 느림·보통·빠름을 가른다', () => {
    const { slow, fast } = SPEECH_PACE_BANDS.wpm
    expect(speechPaceLevel(slow - 1, 'wpm')).toBe('slow')
    expect(speechPaceLevel(slow, 'wpm')).toBe('normal')
    expect(speechPaceLevel(fast, 'wpm')).toBe('normal')
    expect(speechPaceLevel(fast + 1, 'wpm')).toBe('fast')
  })

  test('초당 음절도 같은 방식으로 판정한다', () => {
    expect(speechPaceLabel(2.4, 'syllablesPerSecond')).toBe('느림')
    expect(speechPaceLabel(2.5, 'syllablesPerSecond')).toBe('보통')
    expect(speechPaceLabel(4, 'syllablesPerSecond')).toBe('보통')
    expect(speechPaceLabel(4.1, 'syllablesPerSecond')).toBe('빠름')
  })

  test('아직 측정값이 없으면 라벨을 만들지 않는다', () => {
    expect(speechPaceLevel(null)).toBeNull()
    expect(speechPaceLevel(0)).toBeNull()
    expect(speechPaceLevel('없음')).toBeNull()
    expect(speechPaceLabel(undefined)).toBe('--')
    expect(speechPaceLabel(undefined, 'wpm', '-')).toBe('-')
  })

  test('툴팁에는 원래 수치와 보통 구간을 함께 남긴다', () => {
    expect(speechPaceDetail(133.33, 'wpm')).toBe('133 분당 어절 · 보통 구간 80~120')
    expect(speechPaceDetail(3.7, 'syllablesPerSecond')).toBe('3.7 초당 음절 · 보통 구간 2.5~4')
    expect(speechPaceDetail(null)).toContain('없어요')
  })
})
