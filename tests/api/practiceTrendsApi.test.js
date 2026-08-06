import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { userApi } from '../../src/api/userApi.js'

describe('practice trends API contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests the unified practice trends endpoint', async () => {
    await userApi.getPracticeTrends()

    expect(globalThis.fetch.mock.calls.at(-1)[0]).toBe('/api/v1/practices/trends')
    expect(globalThis.fetch.mock.calls.at(-1)[1]).toMatchObject({ method: 'GET' })
  })
})
