import { describe, expect, it } from 'vitest'

import { readApiCollection, readApiValue, unwrapApiResponse } from '../../src/api/response.js'

describe('API response helpers', () => {
  it('unwraps HTTP envelopes and accepts raw mock payloads', () => {
    expect(unwrapApiResponse({ data: { id: 1 } })).toEqual({ id: 1 })
    expect(unwrapApiResponse({ id: 2 })).toEqual({ id: 2 })
    expect(unwrapApiResponse(null)).toEqual({})
  })

  it('accepts a direct collection response', () => {
    const items = [{ id: 1 }]
    expect(readApiCollection(items, ['items'])).toBe(items)
  })

  it('uses domain keys in the declared precedence order', () => {
    const folders = [{ id: 'folder' }]
    const items = [{ id: 'item' }]
    const response = { data: { folders, items } }

    expect(readApiCollection(response, ['folders', 'items', 'content'])).toBe(folders)
    expect(readApiCollection(response, ['items', 'folders', 'content'])).toBe(items)
  })

  it('returns an empty collection when no supported key exists', () => {
    expect(readApiCollection({ data: { result: 'ok' } }, ['items'])).toEqual([])
  })

  it('reads scalar values using the declared key precedence', () => {
    const response = { data: { sessionId: 'session-1', id: 'generic-1' } }
    expect(readApiValue(response, ['sessionId', 'id'])).toBe('session-1')
    expect(readApiValue(response, ['recordingId', 'id'])).toBe('generic-1')
    expect(readApiValue(response, ['missing'], 'fallback')).toBe('fallback')
  })
})
