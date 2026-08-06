import { describe, expect, test, vi } from 'vitest'

import { ApiError } from '../../src/api/client.js'
import { withMock } from '../../src/api/withMock.js'

describe('withMock', () => {
  test.each([
    new TypeError('Failed to fetch'),
    new ApiError('Not Found', { status: 404 }),
    new ApiError('Service Unavailable', { status: 503 }),
    new ApiError('API endpoint returned the SPA document', { status: 200, code: 'SPA_FALLBACK' }),
  ])('uses fallback only when the API is unavailable', async (error) => {
    const fallback = vi.fn(() => ({ source: 'mock' }))

    await expect(withMock(() => Promise.reject(error), fallback)).resolves.toEqual({ source: 'mock' })
    expect(fallback).toHaveBeenCalledOnce()
  })

  test.each([
    new ApiError('Unauthorized', { status: 401 }),
    new ApiError('Forbidden', { status: 403 }),
    new ApiError('Unprocessable Entity', { status: 422 }),
    new Error('unexpected application error'),
  ])('propagates application errors instead of masking them', async (error) => {
    const fallback = vi.fn()

    await expect(withMock(() => Promise.reject(error), fallback)).rejects.toBe(error)
    expect(fallback).not.toHaveBeenCalled()
  })
})
