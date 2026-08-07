import { get, post } from './client.js'
import { withQuery } from './query.js'

export const authApi = {
  login(credentials) {
    return post('/auth/login', credentials)
  },

  register(payload) {
    return post('/auth/register', payload)
  },

  logout() {
    return post('/auth/logout')
  },

  me() {
    return get('/users/me')
  },

  // 계정(아이디) 찾기 — 이름·이메일 등 식별 정보로 가입 계정을 조회한다.
  findId(payload) {
    return post('/auth/find-id', payload)
  },

  // 비밀번호 재설정 메일 발송 요청.
  requestPasswordReset(payload) {
    return post('/auth/password-reset/requests', payload)
  },

  // 이메일 중복확인 — 회원가입 시 사용 가능 여부를 조회한다.
  checkEmail(email) {
    return get(withQuery('/auth/check-email', { email }))
  },
}
