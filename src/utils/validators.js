import { INPUT_LIMITS } from '../constants/inputLimits.js'
import {
  TEXT_INPUT_POLICIES,
  countGraphemes,
  textPolicyValidationMessage,
} from './textInputPolicy.js'

// 폼 검증 공용 유틸. 인증 화면(로그인·회원가입·계정 찾기)과 마이페이지 보안
// 화면이 같은 규칙을 공유하도록 한곳에 모은다. 규칙을 바꾸려면 여기만 고친다.

// 간단한 이메일 형식 검사(로컬@도메인.tld). 서버 검증을 대체하지 않는다.
const EMAIL_RE = /^\S+@\S+\.\S+$/

export const isEmail = (value) => EMAIL_RE.test(String(value ?? '').trim())

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 20
export const MIN_USERNAME_LENGTH = INPUT_LIMITS.USERNAME_MIN
export const MAX_USERNAME_LENGTH = INPUT_LIMITS.USERNAME
export const MAX_EMAIL_LENGTH = 254

export const practiceTitleValidationMessage = (value) => {
  const title = String(value ?? '').trim()
  if (!title) return '연습 이름을 입력해주세요.'
  const policyMessage = textPolicyValidationMessage(title, {
    policy: TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT,
  })
  if (policyMessage) return policyMessage
  const length = countGraphemes(title)
  if (length > INPUT_LIMITS.PRACTICE_TITLE) {
    return `연습 이름은 ${INPUT_LIMITS.PRACTICE_TITLE}자 이하로 입력해주세요. (현재 ${length}자)`
  }
  return ''
}

export const isStrongPassword = (value) => {
  const password = String(value ?? '')
  return password.length >= MIN_PASSWORD_LENGTH
    && password.length <= MAX_PASSWORD_LENGTH
    && /[A-Za-z]/.test(password)
    && /\d/.test(password)
    && /^[\x21-\x7E]+$/.test(password)
}

export const usernameValidationMessage = (value) => {
  const username = String(value ?? '').trim()
  if (!username) return '닉네임을 입력해주세요.'
  const policyMessage = textPolicyValidationMessage(username, {
    policy: TEXT_INPUT_POLICIES.NICKNAME,
  })
  if (policyMessage) return policyMessage
  const length = countGraphemes(username)
  if (length < MIN_USERNAME_LENGTH || length > MAX_USERNAME_LENGTH) {
    return `닉네임은 ${MIN_USERNAME_LENGTH}~${MAX_USERNAME_LENGTH}자로 입력해주세요. (현재 ${length}자)`
  }
  return ''
}

export const isFilled = (value) => String(value ?? '').trim().length > 0

// 표준 안내 문구. 화면마다 문구가 어긋나지 않도록 통일한다.
export const authMessages = {
  email: '올바른 이메일 형식을 입력해주세요.',
  name: '이름을 입력해주세요.',
  password: `비밀번호는 영문과 숫자를 포함해 ${MIN_PASSWORD_LENGTH}~${MAX_PASSWORD_LENGTH}자로 입력해주세요. 공백과 한글은 사용할 수 없어요.`,
  passwordRequired: '비밀번호를 입력해주세요.',
  passwordMismatch: '비밀번호가 일치하지 않아요.',
}
