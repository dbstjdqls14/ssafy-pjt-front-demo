import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { authApi, userApi } from '../api/index.js'
import { ApiError } from '../api/client.js'
import { getAccessToken, setAccessToken, clearAccessToken } from '../api/authToken.js'
import { extractAccessToken, extractAuthUser } from '../api/normalizers/auth.js'
import { withMock } from '../api/withMock.js'
import { decodeJwtPayload, isJwtExpired } from '../utils/jwt.js'
import { LOCAL_STORAGE_KEYS } from '../constants/storageKeys.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'

const USER_KEY = LOCAL_STORAGE_KEYS.user
// Pre-refactor key written by the old mock auth. Read-only migration fallback so
// sessions created before the Vue migration still load; no longer written to.
const LEGACY_USER_KEY = LOCAL_STORAGE_KEYS.legacyUser

const loadStoredUser = () => (
  readJsonStorage(localStorage, USER_KEY)
  ?? readJsonStorage(localStorage, LEGACY_USER_KEY)
)

// 저장된 토큰이 없거나 만료됐으면 로그아웃 상태로 시작한다(유저 캐시와 토큰 정합성).
const loadInitialUser = () => {
  const token = getAccessToken()
  if (!token || isJwtExpired(token)) {
    clearAccessToken()
    return null
  }
  const stored = loadStoredUser()
  // 구버전 캐시(닉네임 없음)로 인증 컴포넌트가 깨지지 않도록 백필.
  if (stored && !stored.nickname && stored.email) {
    stored.nickname = stored.email.split('@')[0]
  }
  return stored
}

// 로그인/회원가입 응답에는 사용자 객체가 없고 accessToken만 온다. 토큰에서 userId를
// 꺼내고 입력한 이메일·닉네임을 합쳐 최소 사용자 정보를 구성한다.
// ⚠️ AppHeader 등 여러 컴포넌트가 user.nickname 존재를 전제로 하므로(예:
// nickname.slice(0,1)), 로그인 응답에 닉네임이 없으면 이메일 앞부분으로 채워
// 인증 상태에서 렌더가 깨지지 않게 한다.
const buildUserFromToken = (token, extra = {}) => {
  const payload = decodeJwtPayload(token)
  const cleaned = Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null && v !== ''))
  if (!cleaned.nickname && cleaned.email) cleaned.nickname = cleaned.email.split('@')[0]
  return { userId: payload?.userId ?? null, ...cleaned }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(loadInitialUser())
  const isLoading = ref(false)
  const error = ref(null)
  const profileImageRevision = ref(0)
  let profileImageRefreshPromise = null

  const isAuthenticated = computed(() => Boolean(user.value))
  const profileImageIdentity = computed(() => (
    `${String(user.value?.profileImageUrl ?? '')}::${profileImageRevision.value}`
  ))

  const persist = () => {
    if (user.value) writeJsonStorage(localStorage, USER_KEY, user.value)
    else localStorage.removeItem(USER_KEY)
    // Clear the stale pre-refactor key so it can't shadow a real logout.
    localStorage.removeItem(LEGACY_USER_KEY)
  }

  const setUser = (nextUser, { refreshProfileImage = false } = {}) => {
    const previousProfileImageUrl = String(user.value?.profileImageUrl ?? '')
    const nextProfileImageUrl = String(nextUser?.profileImageUrl ?? '')
    user.value = nextUser
    if (refreshProfileImage || previousProfileImageUrl !== nextProfileImageUrl) {
      profileImageRevision.value += 1
    }
    persist()
  }

  // 로그인은 실제 서버로만 처리한다(mock 폴백 없음 — 가짜 성공은 오히려 위험).
  // 응답에서 accessToken을 저장하고, 토큰의 userId + 입력 이메일로 유저를 구성.
  const login = async (credentials = {}) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await authApi.login({
        email: credentials.email,
        password: credentials.password,
      })
      const token = extractAccessToken(result)
      if (!token) throw new ApiError('로그인 응답에 토큰이 없습니다.', { status: 500 })
      setAccessToken(token)
      setUser(buildUserFromToken(token, { email: credentials.email }))
      try {
        await loadMe()
      } catch {
        // 로그인 자체는 성공했으므로 /users/me 일시 실패 시 토큰 기반 상태를 유지한다.
      }
      return result
    } catch (caught) {
      error.value = caught
      throw caught
    } finally {
      isLoading.value = false
    }
  }

  // 회원가입도 실서버로만. 성공 시 accessToken이 함께 와서 바로 로그인 상태가 된다.
  const register = async (payload = {}) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await authApi.signup({
        email: payload.email,
        password: payload.password,
        nickname: payload.nickname,
      })
      const token = extractAccessToken(result)
      if (token) {
        setAccessToken(token)
        setUser(buildUserFromToken(token, { email: payload.email, nickname: payload.nickname }))
      }
      return result
    } catch (caught) {
      error.value = caught
      throw caught
    } finally {
      isLoading.value = false
    }
  }

  const updateProfile = async (payload = {}) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await userApi.updateProfile(payload)
      const responseUser = extractAuthUser(result) ?? {}
      const optimisticUser = {
        ...user.value,
        ...(payload.nickname?.trim() ? { nickname: payload.nickname.trim() } : {}),
        ...(payload.removeProfileImage ? { profileImageUrl: null } : {}),
        ...responseUser,
      }
      setUser(optimisticUser, { refreshProfileImage: true })
      void loadMe().catch(() => null)
      return result
    } catch (caught) {
      error.value = caught
      throw caught
    } finally {
      isLoading.value = false
    }
  }

  const changePassword = async (payload = {}) => {
    return withMock(() => userApi.changePassword(payload), () => ({ success: true }))
  }

  const loadMe = async () => {
    const response = await withMock(() => authApi.me(), () => loadStoredUser())
    const me = extractAuthUser(response)
    if (me) setUser({ ...user.value, ...me }, { refreshProfileImage: true })
    return me
  }

  const refreshProfileImage = () => {
    if (!user.value) return Promise.resolve(null)
    if (profileImageRefreshPromise) return profileImageRefreshPromise

    const requestedIdentity = user.value.userId ?? user.value.id ?? user.value.email
    profileImageRefreshPromise = (async () => {
      const response = await authApi.me()
      const me = extractAuthUser(response)
      const currentIdentity = user.value?.userId ?? user.value?.id ?? user.value?.email
      if (user.value && requestedIdentity === currentIdentity) {
        setUser({ ...user.value, ...me })
      }
      return me
    })().finally(() => {
      profileImageRefreshPromise = null
    })
    return profileImageRefreshPromise
  }

  // 회원 탈퇴 — 서버에 계정 삭제를 요청하고, 성공하면 로컬 인증 상태도 정리한다.
  const withdraw = async () => {
    await withMock(() => userApi.deleteAccount(), () => ({ success: true }))
    clearAccessToken()
    setUser(null)
  }

  const logout = async () => {
    try {
      // Authorization 헤더는 client가 저장된 토큰으로 자동 첨부한다.
      await authApi.logout()
    } catch {
      /* 서버 로그아웃 실패해도 로컬 상태는 반드시 정리 */
    }
    clearAccessToken()
    setUser(null)
  }

  return {
    user,
    isLoading,
    error,
    isAuthenticated,
    profileImageRevision,
    profileImageIdentity,
    setUser,
    login,
    register,
    updateProfile,
    changePassword,
    loadMe,
    refreshProfileImage,
    withdraw,
    logout,
  }
})
