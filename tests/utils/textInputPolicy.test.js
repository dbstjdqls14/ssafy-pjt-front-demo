import { describe, expect, test } from 'vitest'

import {
  TEXT_INPUT_POLICIES,
  countGraphemes,
  hasEmojiPresentation,
  sliceGraphemes,
  textPolicyValidationMessage,
} from '../../src/utils/textInputPolicy.js'

describe('text input policy', () => {
  test.each([
    ['한글과 ASCII를 보이는 문자 수로 센다', '가A1 나', 5],
    ['단일 이모지를 한 글자로 센다', '가😀나', 3],
    ['피부색 결합 이모지를 한 글자로 센다', '👍🏽', 1],
    ['국기 이모지를 한 글자로 센다', '🇰🇷', 1],
    ['ZWJ 가족 이모지를 한 글자로 센다', '👨‍👩‍👧‍👦', 1],
    ['CRLF를 줄바꿈 한 글자로 센다', '가\r\n나', 3],
    ['분해된 한글을 완성된 한글 한 글자로 센다', '가', 1],
  ])('%s', (_label, value, expected) => {
    expect(countGraphemes(value)).toBe(expected)
  })

  test('single-line content accepts only Hangul, ASCII letters, digits, spaces, and @', () => {
    const valid = textPolicyValidationMessage('AIVO 발표 2026 @삼성', {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT,
      maxLength: 30,
    })
    const invalid = textPolicyValidationMessage('AIVO 발표😀世界', {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT,
      maxLength: 30,
    })

    expect(valid).toBe('')
    expect(invalid).toBe('한글, 영문, 숫자, 공백, @만 입력할 수 있어요.')
  })

  test('multi-line prose allows tabs and Han characters but rejects emoji', () => {
    expect(textPolicyValidationMessage('첫 줄입니다.\n둘째 줄은 @A1인가요?', {
      policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
      maxLength: 30,
    })).toBe('')
    expect(textPolicyValidationMessage('첫 줄\t世界', {
      policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
      maxLength: 30,
    })).toBe('')
    expect(textPolicyValidationMessage('첫 줄 😊', {
      policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
      maxLength: 30,
    })).toBe('이모지는 입력할 수 없어요.')
  })

  test('single-line prose leaves line handling to the control and rejects emoji', () => {
    expect(textPolicyValidationMessage('이 선택이 왜 필요한가요?', {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_PROSE,
      maxLength: 30,
    })).toBe('')
    expect(textPolicyValidationMessage('질문?\n다음 줄 日本語', {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_PROSE,
      maxLength: 30,
    })).toBe('')
    expect(textPolicyValidationMessage('질문😀', {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_PROSE,
      maxLength: 30,
    })).toBe('이모지는 입력할 수 없어요.')
  })

  test('nickname accepts underscore but rejects spaces and emoji', () => {
    expect(textPolicyValidationMessage('사용자_A1', {
      policy: TEXT_INPUT_POLICIES.NICKNAME,
      maxLength: 20,
    })).toBe('')
    expect(textPolicyValidationMessage('사용자 😀', {
      policy: TEXT_INPUT_POLICIES.NICKNAME,
      maxLength: 20,
    })).toBe('닉네임은 한글, 영문, 숫자, 밑줄만 입력할 수 있어요.')
  })

  test('reports invalid characters before a simultaneous grapheme length overflow', () => {
    expect(textPolicyValidationMessage(`${'가'.repeat(15)}😀`, {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT,
      maxLength: 15,
    })).toBe('한글, 영문, 숫자, 공백, @만 입력할 수 있어요.')
  })

  test('reports grapheme length without truncating or changing the supplied value', () => {
    const value = `가나다라마바사아자차카타파하😀`

    expect(textPolicyValidationMessage(value, {
      policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
      maxLength: 14,
    })).toBe('이모지는 입력할 수 없어요.')
    expect(value).toBe('가나다라마바사아자차카타파하😀')
    expect(textPolicyValidationMessage('가'.repeat(16), {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT,
      maxLength: 15,
    })).toBe('최대 15자까지 입력할 수 있어요.')
  })

  test('slices at grapheme boundaries without breaking a combined emoji', () => {
    expect(sliceGraphemes('가👨‍👩‍👧‍👦나다', 3)).toBe('가👨‍👩‍👧‍👦나')
    expect(sliceGraphemes('가나다', 0)).toBe('')
  })

  test('distinguishes plain text symbols from emoji presentation sequences', () => {
    expect(hasEmojiPresentation('© ♥ ℃ → ··· ‘문장’ 日本語\t')).toBe(false)
    expect(hasEmojiPresentation('😊 ❤️ 🇰🇷 1️⃣ 👨‍👩‍👧‍👦')).toBe(true)
  })

  test('prose allows every non-emoji character and rejects emoji only', () => {
    expect(textPolicyValidationMessage('‘오늘의 건수’ ··· 日本語\t', {
      policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
      maxLength: 100,
    })).toBe('')
    expect(textPolicyValidationMessage('질문 中 العربية\n두 번째 줄', {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_PROSE,
      maxLength: 100,
    })).toBe('')
    expect(textPolicyValidationMessage('설명 😊', {
      policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
      maxLength: 100,
    })).toBe('이모지는 입력할 수 없어요.')
  })
})
