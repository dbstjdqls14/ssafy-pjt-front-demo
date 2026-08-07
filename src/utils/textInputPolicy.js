export const TEXT_INPUT_POLICIES = Object.freeze({
  NICKNAME: 'nickname',
  SINGLE_LINE_CONTENT: 'singleLineContent',
  SINGLE_LINE_PROSE: 'singleLineProse',
  MULTI_LINE_CONTENT: 'multiLineContent',
})

const POLICY_PATTERNS = Object.freeze({
  [TEXT_INPUT_POLICIES.NICKNAME]: /^[\p{Script=Hangul}A-Za-z0-9_]*$/u,
  [TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT]: /^[\p{Script=Hangul}A-Za-z0-9 @]*$/u,
  [TEXT_INPUT_POLICIES.SINGLE_LINE_PROSE]: null,
  [TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT]: null,
})

const POLICY_MESSAGES = Object.freeze({
  [TEXT_INPUT_POLICIES.NICKNAME]: '닉네임은 한글, 영문, 숫자, 밑줄만 입력할 수 있어요.',
  [TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT]: '한글, 영문, 숫자, 공백, @만 입력할 수 있어요.',
  [TEXT_INPUT_POLICIES.SINGLE_LINE_PROSE]: '이모지는 입력할 수 없어요.',
  [TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT]: '이모지는 입력할 수 없어요.',
})

const PROSE_POLICIES = new Set([
  TEXT_INPUT_POLICIES.SINGLE_LINE_PROSE,
  TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
])
const EMOJI_PRESENTATION_PATTERN = /\p{Emoji_Presentation}/u
const EMOJI_MODIFIER_PATTERN = /\p{Emoji_Modifier}/u
const EMOJI_VARIATION_SELECTOR_PATTERN = /\uFE0F/u
const KEYCAP_EMOJI_PATTERN = /[#*0-9]\uFE0F?\u20E3/u

const segmenter = typeof Intl?.Segmenter === 'function'
  ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
  : null

const normalizeForInspection = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .normalize('NFC')

const splitGraphemes = (value) => {
  const text = String(value ?? '')
  if (segmenter) return [...segmenter.segment(text)].map((part) => part.segment)
  return Array.from(text)
}

export const countGraphemes = (value) => {
  const normalized = normalizeForInspection(value)
  return splitGraphemes(normalized).length
}

export const sliceGraphemes = (value, maxLength) => {
  const text = String(value ?? '')
  if (!Number.isInteger(maxLength) || maxLength < 0) return text
  return splitGraphemes(text).slice(0, maxLength).join('')
}

export const hasEmojiPresentation = (value) => {
  const normalized = normalizeForInspection(value)
  return EMOJI_PRESENTATION_PATTERN.test(normalized)
    || EMOJI_MODIFIER_PATTERN.test(normalized)
    || EMOJI_VARIATION_SELECTOR_PATTERN.test(normalized)
    || KEYCAP_EMOJI_PATTERN.test(normalized)
}

export const textPolicyValidationMessage = (value, { policy, maxLength } = {}) => {
  if (!Object.hasOwn(POLICY_PATTERNS, policy)) {
    throw new TypeError(`Unknown text input policy: ${policy}`)
  }

  const normalized = normalizeForInspection(value)
  if (PROSE_POLICIES.has(policy)) {
    if (hasEmojiPresentation(normalized)) return POLICY_MESSAGES[policy]
  } else if (!POLICY_PATTERNS[policy].test(normalized)) {
    return POLICY_MESSAGES[policy]
  }
  if (Number.isInteger(maxLength) && maxLength >= 0 && countGraphemes(normalized) > maxLength) {
    return `최대 ${maxLength}자까지 입력할 수 있어요.`
  }
  return ''
}
