import { describe, expect, test } from 'vitest'

import {
  practiceTitleValidationMessage,
  stripEmoji,
} from '../../src/utils/validators.js'

describe('practice title validation', () => {
  test('removes pasted emoji sequences while preserving ordinary title punctuation', () => {
    expect(stripEmoji('A사 백엔드/AI 면접 😁')).toBe('A사 백엔드/AI 면접 ')
    expect(stripEmoji('발표-1차 🇰🇷 👍🏽 1️⃣')).toBe('발표-1차   ')
  })

  test('reports emoji in titles that bypass the setup input', () => {
    expect(practiceTitleValidationMessage('서비스 소개 😁')).toContain('이모지')
    expect(practiceTitleValidationMessage('서비스 소개 (1차)')).toBe('')
  })
})
