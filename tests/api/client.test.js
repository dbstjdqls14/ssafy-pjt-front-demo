import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest, get, post } from '../../src/api/client.js'
import { getAccessToken, setAccessToken } from '../../src/api/authToken.js'

const jsonResponse = (payload, init = {}) => new Response(JSON.stringify(payload), {
  status: init.status ?? 200,
  statusText: init.statusText,
  headers: { 'Content-Type': 'application/json', ...init.headers },
})

afterEach(() => {
  setAccessToken(null)
  vi.unstubAllGlobals()
})

describe('API client', () => {
  it('sends JSON requests to the configured API base path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    await post('/sessions', { title: 'AIVO' })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/sessions', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: '{"title":"AIVO"}',
    }))
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('preserves absolute URLs and FormData bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const formData = new FormData()
    formData.append('type', 'resume')

    await apiRequest('https://api.example.com/upload', { method: 'POST', body: formData })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/upload')
    expect(options.body).toBe(formData)
    expect(options.headers.has('Content-Type')).toBe(false)
  })

  it('returns text responses and keeps GET requests body-free', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ready', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(get('/health')).resolves.toBe('ready')
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  })

  it('rejects an SPA HTML fallback returned as a successful API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })))

    await expect(get('/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      message: 'API endpoint returned the SPA document',
    })
  })

  it('exposes failed response status and payload through ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(
      { code: 'INVALID_SESSION' },
      { status: 400, statusText: 'Bad Request' },
    ))))

    await expect(get('/sessions/missing')).rejects.toEqual(expect.objectContaining({
      name: 'ApiError',
      status: 400,
      payload: { code: 'INVALID_SESSION' },
    }))

    try {
      await get('/sessions/missing')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
    }
  })

  it('clears the access token and announces authentication expiry on 401', async () => {
    const dispatchEvent = vi.fn()
    vi.stubGlobal('window', { dispatchEvent })
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(type) {
        this.type = type
      }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    )))
    setAccessToken('expired-token')

    await expect(get('/protected')).rejects.toMatchObject({ status: 401 })

    expect(getAccessToken()).toBeNull()
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'aivo:auth-expired',
    }))
  })
})
