import { beforeEach, describe, expect, it, vi } from 'vitest'

const { patch } = vi.hoisted(() => ({ patch: vi.fn() }))

vi.mock('../../src/api/client.js', () => ({
  del: vi.fn(),
  get: vi.fn(),
  patch,
}))

import { userApi } from '../../src/api/userApi.js'

describe('userApi', () => {
  beforeEach(() => patch.mockReset())

  it('sends profile updates using the Spring multipart contract', async () => {
    const profileImage = new File(['avatar'], 'avatar.png', { type: 'image/png' })

    userApi.updateProfile({ nickname: 'AIVO', profileImage })

    const [path, formData] = patch.mock.calls[0]
    expect(path).toBe('/users/me')
    expect(formData).toBeInstanceOf(FormData)
    expect(await formData.get('request').text()).toBe('{"nickname":"AIVO","removeProfileImage":false}')
    expect(formData.get('profileImage')).toBe(profileImage)
  })
})
