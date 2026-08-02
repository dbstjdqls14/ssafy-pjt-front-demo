import { del, get, patch } from './client.js'
import { createJsonRequestFormData } from './formData.js'
import { withQuery } from './query.js'

// 로그인 사용자(/users/me) 하위의 프로필·보안·통계 엔드포인트.
// 인증(/auth)과 지원 자료(/users/me/documents)는 각각 authApi·documentApi가 담당한다.
export const userApi = {
  // 프로필 수정 — 닉네임 등 기본 정보를 변경한다.
  updateProfile(payload) {
    const { profileImage, removeProfileImage = false, ...request } = payload
    return patch('/users/me', createJsonRequestFormData(
      { ...request, removeProfileImage: Boolean(removeProfileImage) },
      { profileImage },
    ))
  },

  // 회원 탈퇴 — 계정과 연관 데이터 삭제 정책을 수행한다.
  deleteAccount() {
    return del('/users/me')
  },

  // 비밀번호 변경.
  changePassword(payload) {
    return patch('/users/me/password', payload)
  },

  // 학습 추이 — 기간별 종합점수·연습량 등 통계를 조회한다.
  getStats({ type = '', period = '' } = {}) {
    return get(withQuery('/users/me/stats', { type, period }))
  },
}
