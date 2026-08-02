import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../../src/api/client.js', () => ({
  del: vi.fn(),
  get,
  post,
}))

import { interviewApi } from '../../src/api/interviewApi.js'

describe('interviewApi', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('sends a 10-second WAV chunk using the shared practice endpoint', () => {
    const blob = new Blob(['audio'], { type: 'audio/wav' })

    interviewApi.analyzeAudio(15, { blob, sequence: 3 })

    expect(post).toHaveBeenCalledTimes(1)
    const [path, formData] = post.mock.calls[0]
    expect(path).toBe('/practices/15/audio-analysis?sequence=3')
    expect(formData.has('sequence')).toBe(false)
    expect(formData.get('audio')).toBeInstanceOf(File)
    expect(formData.get('audio').name).toBe('answer-3.wav')
    expect(formData.get('audio').type).toBe('audio/wav')
  })

  it('reads interview questions and per-question feedback', () => {
    interviewApi.getQuestions(15)
    interviewApi.getQuestionFeedback(15, 22)

    expect(get).toHaveBeenNthCalledWith(1, '/interviews/15/questions')
    expect(get).toHaveBeenNthCalledWith(2, '/interviews/15/questions/22/feedbacks')
  })
})
