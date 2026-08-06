import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('../../src/api/client.js', () => ({
  del: vi.fn(),
  get: vi.fn(),
  post,
}))

import { interviewApi } from '../../src/api/interviewApi.js'

describe('interviewApi', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('sends a 10-second WAV chunk using the shared practice endpoint', () => {
    const blob = new Blob(['audio'], { type: 'audio/wav' })

    interviewApi.analyzeAudio(15, { blob, sequence: 3 })

    expect(post).toHaveBeenCalledTimes(1)
    const [path, formData] = post.mock.calls[0]
    expect(path).toBe('/practices/15/audio-analysis')
    expect(formData.get('sequence')).toBe('3')
    expect(formData.get('audio')).toBeInstanceOf(File)
    expect(formData.get('audio').name).toBe('answer-3.wav')
    expect(formData.get('audio').type).toBe('audio/wav')
  })
})
