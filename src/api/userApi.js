import { del, get, patch } from './client.js'

const createProfileFormData = ({ nickname, removeProfileImage, profileImage }) => {
  const formData = new FormData()
  formData.append('request', new Blob([
    JSON.stringify({ nickname, removeProfileImage }),
  ], { type: 'application/json' }))
  if (profileImage) formData.append('profileImage', profileImage, profileImage.name)
  return formData
}

// 로그인 사용자(/users/me) 하위의 프로필·보안·통계 엔드포인트.
// 인증은 authApi, 지원 자료는 resumeApi와 portfolioApi가 각각 담당한다.
export const userApi = {
  // 프로필 수정 — 닉네임 등 기본 정보를 변경한다.
  updateProfile(payload) {
    return patch('/users/me', createProfileFormData(payload))
  },

  // 회원 탈퇴 — 계정과 연관 데이터 삭제 정책을 수행한다.
  deleteAccount() {
    return del('/users/me')
  },

  // 비밀번호 변경.
  changePassword(payload) {
    return patch('/users/me/password', payload)
  },

  // 발표·면접을 통합한 완료 연습의 성장 추이를 조회한다.
  getPracticeTrends() {
    return get('/practices/trends')
  },
}
