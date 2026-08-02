// 액세스 토큰 보관소. client.js(요청 시 Authorization 주입)와 authStore(로그인/
// 로그아웃 시 토큰 갱신)가 순환 import 없이 공유하기 위한 얇은 모듈.
// 백엔드 로그인 응답은 accessToken만 주고 refreshToken은 내려오지 않으므로
// (2026-07 배포 기준) 지금은 accessToken만 다룬다. reissue가 열리면 확장.
import { LOCAL_STORAGE_KEYS } from '../constants/storageKeys.js'

const KEY = LOCAL_STORAGE_KEYS.accessToken

const readInitial = () => {
  try {
    return localStorage.getItem(KEY) || null
  } catch {
    return null
  }
}

let accessToken = readInitial()

export const getAccessToken = () => accessToken

export const setAccessToken = (token) => {
  accessToken = token || null
  try {
    if (accessToken) localStorage.setItem(KEY, accessToken)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage 불가 환경(SSR·프라이빗 모드)에서도 메모리 토큰은 유지 */
  }
}

export const clearAccessToken = () => setAccessToken(null)
