import { clearAccessToken, getAccessToken } from './authToken.js'

const viteEnv = import.meta.env ?? {}

export const API_BASE_URL = viteEnv.VITE_API_BASE_URL ?? '/api/v1'

const isFormData = (body) => typeof FormData !== 'undefined' && body instanceof FormData

export class ApiError extends Error {
  constructor(message, { status, payload, code } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
    this.code = code
  }
}

// 405(Method Not Allowed)는 이 백엔드에선 '해당 API가 아직 구현 전'이라는 뜻으로
// 온다(예: /practice-folders 목록 GET 미구현) → 목 데이터로 대체해 화면을 살린다.
const UNAVAILABLE_API_STATUSES = new Set([404, 405, 501, 502, 503, 504])

export const isApiUnavailableError = (error) => (
  error instanceof TypeError
  || (
    error instanceof ApiError
    && (error.code === 'SPA_FALLBACK' || UNAVAILABLE_API_STATUSES.has(error.status))
  )
)

const buildUrl = (path) => {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const base = API_BASE_URL.replace(/\/$/, '')
  const endpoint = path.startsWith('/') ? path : `/${path}`

  return `${base}${endpoint}`
}

export const apiRequest = async (path, options = {}) => {
  const headers = new Headers(options.headers)
  const body = options.body

  if (body && !isFormData(body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  // 로그인 시 저장한 accessToken을 모든 요청에 자동 첨부(호출부가 직접 지정한
  // Authorization은 존중). 백엔드는 Bearer 토큰으로 사용자를 식별한다.
  const accessToken = getAccessToken()
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(buildUrl(path), {
    credentials: 'include',
    ...options,
    headers,
    body: body && !isFormData(body) && typeof body !== 'string' ? JSON.stringify(body) : body,
  })

  const contentType = response.headers.get('Content-Type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()

  // A missing API route can be swallowed by an SPA fallback and return
  // index.html with HTTP 200. Treat that as an unavailable endpoint so
  // withMock() can supply the local demo response instead of accepting HTML
  // as valid API data.
  if (response.ok && contentType.includes('text/html')) {
    throw new ApiError('API endpoint returned the SPA document', {
      status: response.status,
      payload,
      code: 'SPA_FALLBACK',
    })
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken()
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('aivo:auth-expired'))
      }
    }

    // 백엔드 에러 봉투: { code, errorCode, message, status }. 사람이 읽을
    // 메시지와 도메인 코드를 최대한 살려서 던진다. message가 없으면
    // "Internal Server Error" 같은 영문 상태 문구 대신 사용자용 한글 안내로 바꾼다.
    const friendlyByStatus = {
      400: '요청이 올바르지 않아요. 입력한 내용을 확인해주세요.',
      401: '로그인이 필요해요. 다시 로그인해주세요.',
      403: '접근 권한이 없어요.',
      404: '요청한 정보를 찾을 수 없어요.',
      405: '아직 준비되지 않은 기능이에요.',
      500: '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
      502: '서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해주세요.',
      503: '서버가 점검 중이에요. 잠시 후 다시 시도해주세요.',
      504: '서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.',
    }
    const message = (payload && typeof payload === 'object' && payload.message)
      || friendlyByStatus[response.status]
      || response.statusText
      || '요청을 처리하지 못했어요.'
    throw new ApiError(message, {
      status: response.status,
      payload,
      code: (payload && typeof payload === 'object' && (payload.code ?? payload.errorCode)) || undefined,
    })
  }

  return payload
}

export const get = (path, options) => apiRequest(path, { ...options, method: 'GET' })
export const post = (path, body, options) => apiRequest(path, { ...options, method: 'POST', body })
export const put = (path, body, options) => apiRequest(path, { ...options, method: 'PUT', body })
export const patch = (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body })
export const del = (path, options) => apiRequest(path, { ...options, method: 'DELETE' })
