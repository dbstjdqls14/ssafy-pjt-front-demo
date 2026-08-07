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

const UNAVAILABLE_API_STATUSES = new Set([404, 501, 502, 503, 504])

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
    throw new ApiError(response.statusText || 'API request failed', {
      status: response.status,
      payload,
    })
  }

  return payload
}

export const get = (path, options) => apiRequest(path, { ...options, method: 'GET' })
export const post = (path, body, options) => apiRequest(path, { ...options, method: 'POST', body })
export const patch = (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body })
export const del = (path, options) => apiRequest(path, { ...options, method: 'DELETE' })
