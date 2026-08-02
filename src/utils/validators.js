// 폼 검증 공용 유틸. 인증 화면(로그인·회원가입·계정 찾기)과 마이페이지 보안
// 화면이 같은 규칙을 공유하도록 한곳에 모은다. 규칙을 바꾸려면 여기만 고친다.

// 간단한 이메일 형식 검사(로컬@도메인.tld). 서버 검증을 대체하지 않는다.
const EMAIL_RE = /^\S+@\S+\.\S+$/

export const isEmail = (value) => EMAIL_RE.test(String(value ?? '').trim())

export const MIN_PASSWORD_LENGTH = 8

export const isStrongPassword = (value) => String(value ?? '').length >= MIN_PASSWORD_LENGTH

export const isFilled = (value) => String(value ?? '').trim().length > 0

// 표준 안내 문구. 화면마다 문구가 어긋나지 않도록 통일한다.
export const authMessages = {
  email: '올바른 이메일 형식을 입력해주세요.',
  name: '이름을 입력해주세요.',
  password: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`,
  passwordRequired: '비밀번호를 입력해주세요.',
  passwordMismatch: '비밀번호가 일치하지 않아요.',
}
