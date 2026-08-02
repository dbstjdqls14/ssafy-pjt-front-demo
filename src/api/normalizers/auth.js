import { unwrapApiResponse } from '../response.js'

// 로그인/회원가입 응답에서 accessToken 추출. 실제 형태: { tokenResponse: { accessToken } }.
// 혹시 모를 변형(최상위 accessToken)도 함께 수용.
export const extractAccessToken = (response) => {
  const value = unwrapApiResponse(response)
  return value?.tokenResponse?.accessToken ?? value?.accessToken ?? null
}

export const extractAuthUser = (response) => {
  const value = unwrapApiResponse(response)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const user = value.user ?? value.member ?? value.profile ?? value
  if (!user || typeof user !== 'object' || Array.isArray(user)) return null

  return Object.keys(user).length ? user : null
}

export const isEmailAvailable = (response) => {
  const value = unwrapApiResponse(response)
  if (typeof value.available === 'boolean') return value.available
  if (typeof value.isAvailable === 'boolean') return value.isAvailable
  if (typeof value.duplicated === 'boolean') return !value.duplicated
  if (typeof value.exists === 'boolean') return !value.exists
  return true
}
