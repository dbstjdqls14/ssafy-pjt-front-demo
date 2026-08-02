import { get, post } from './client.js'
import { withQuery } from './query.js'

export const authApi = {
  login(credentials) {
    return post('/auth/login', credentials)
  },

  // 회원가입 — 백엔드 실제 경로는 /auth/signup (기존 /auth/register 아님).
  signup(payload) {
    return post('/auth/signup', payload)
  },

  // 하위호환 별칭: 기존 호출부가 register를 쓰더라도 동작하도록 유지.
  register(payload) {
    return post('/auth/signup', payload)
  },

  // 액세스 토큰 재발급(RTR). refreshToken은 바디로 전달.
  // ⚠️ 현재 배포는 login/signup이 refreshToken을 내려주지 않아 실사용 불가 —
  // 백엔드가 refreshToken 전달 방식을 확정하면 연결한다.
  reissue(refreshToken) {
    return post('/auth/reissue', { refreshToken })
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
