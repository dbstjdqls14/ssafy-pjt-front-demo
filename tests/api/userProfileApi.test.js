import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { userApi } from '../../src/api/userApi.js'

const jsonResponse = (payload = {}) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

const latestRequest = () => {
  const [url, options] = globalThis.fetch.mock.calls.at(-1)
  return { url, options }
}

describe('user profile API contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ nickname: '재용' })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends nickname and image removal intent as the request JSON part', async () => {
    await userApi.updateProfile({
      nickname: '재용',
      removeProfileImage: true,
      profileImage: null,
    })

    const { url, options } = latestRequest()
    expect(url).toBe('/api/v1/users/me')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('request')).toBeInstanceOf(Blob)
    expect(options.body.get('request').type).toBe('application/json')
    await expect(options.body.get('request').text()).resolves.toBe(JSON.stringify({
      nickname: '재용',
      removeProfileImage: true,
    }))
    expect(options.body.has('profileImage')).toBe(false)
  })

  it('includes a selected profile image using the Spring part name', async () => {
    const profileImage = new File(['avatar'], 'avatar.webp', { type: 'image/webp' })

    await userApi.updateProfile({
      nickname: '재용',
      removeProfileImage: false,
      profileImage,
    })

    const { options } = latestRequest()
    expect(options.body.get('profileImage')).toBeInstanceOf(File)
    expect(options.body.get('profileImage').name).toBe('avatar.webp')
  })
})
