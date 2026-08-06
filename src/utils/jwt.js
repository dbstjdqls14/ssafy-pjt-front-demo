// JWT payload 디코딩 (검증 아님 — 서명 검증은 서버 몫). 로그인 응답이 사용자
// 정보 없이 accessToken만 주므로, 토큰에서 userId·만료(exp)만 꺼내 쓴다.
export const decodeJwtPayload = (token) => {
  if (typeof token !== 'string') return null
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

// 만료 여부. exp(초 단위)와 현재 시각 비교. 파싱 실패 시 만료로 간주하지 않음.
export const isJwtExpired = (token) => {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false
  return payload.exp * 1000 <= Date.now()
}
