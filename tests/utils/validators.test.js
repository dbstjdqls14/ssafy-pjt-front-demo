import { describe, expect, test } from 'vitest'

import {
  practiceTitleValidationMessage,
  usernameValidationMessage,
} from '../../src/utils/validators.js'

describe('practice title validation', () => {
  test('uses the shared single-line policy and grapheme length', () => {
    expect(practiceTitleValidationMessage('서비스 소개 😁')).toContain('한글, 영문, 숫자')
    expect(practiceTitleValidationMessage('서비스 소개 (1차)')).toContain('한글, 영문, 숫자')
    expect(practiceTitleValidationMessage('가'.repeat(16))).toContain('현재 16자')
    expect(practiceTitleValidationMessage('서비스 소개 @A1')).toBe('')
  })
})

describe('nickname validation', () => {
  test('counts visible graphemes and keeps the established nickname character policy', () => {
    expect(usernameValidationMessage('사용자_01')).toBe('')
    expect(usernameValidationMessage('사용자😀')).toContain('한글, 영문, 숫자, 밑줄')
    expect(usernameValidationMessage(`${'가'.repeat(20)}😀`)).toContain('한글, 영문, 숫자, 밑줄')
    expect(usernameValidationMessage('가'.repeat(21))).toContain('현재 21자')
  })
})
