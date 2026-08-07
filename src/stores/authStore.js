import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { authApi, userApi } from '../api/index.js'
import { extractAuthUser } from '../api/normalizers/auth.js'
import { withMock } from '../api/withMock.js'
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

export const useAuthStore = defineStore('auth', () => {
  const user = ref(loadStoredUser())
  const isLoading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => Boolean(user.value))

  const persist = () => {
    if (user.value) writeJsonStorage(localStorage, USER_KEY, user.value)
    else localStorage.removeItem(USER_KEY)
    // Clear the stale pre-refactor key so it can't shadow a real logout.
    localStorage.removeItem(LEGACY_USER_KEY)
  }

  const setUser = (nextUser) => {
    user.value = nextUser
    persist()
  }

  const login = async (credentials = {}) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await withMock(
        () => authApi.login(credentials),
        () => ({
          user: {
            nickname: credentials.nickname || '서가은',
            email: credentials.email || 'seogaeun@aivo.app',
          },
        }),
      )
      setUser(extractAuthUser(result))
      return result
    } catch (caught) {
      error.value = caught
      throw caught
    } finally {
      isLoading.value = false
    }
  }

  const register = async (payload = {}) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await withMock(
        () => authApi.register(payload),
        () => ({
          user: {
            nickname: payload.nickname || '새 사용자',
            email: payload.email || '',
          },
        }),
      )
      setUser(extractAuthUser(result))
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
      const result = await withMock(
        () => userApi.updateProfile(payload),
        () => ({ user: { ...user.value, ...payload } }),
      )
      setUser(extractAuthUser(result))
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
    setUser(me)
    return me
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      /* ignore — mock/offline logout still clears local state */
    }
    setUser(null)
  }

  return {
    user,
    isLoading,
    error,
    isAuthenticated,
    setUser,
    login,
    register,
    updateProfile,
    changePassword,
    loadMe,
    logout,
  }
})
