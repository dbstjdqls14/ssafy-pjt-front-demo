import { describe, expect, test } from 'vitest'

import {
  RecordingValidationError,
  assertCompleteMedia,
} from '../../src/utils/recordingValidation.js'

const mediaBlob = (type, size = 1_024) => new Blob([new Uint8Array(size)], { type })

describe('assertCompleteMedia', () => {
  test.each([
    ['zero duration', { durationSeconds: 0 }, 'EMPTY_DURATION'],
    ['missing audio', { durationSeconds: 1, videoBlob: mediaBlob('video/webm') }, 'EMPTY_AUDIO'],
    ['missing video', { durationSeconds: 1, audioBlob: mediaBlob('audio/wav') }, 'EMPTY_VIDEO'],
    ['tiny audio', { durationSeconds: 1, audioBlob: mediaBlob('audio/wav', 20), videoBlob: mediaBlob('video/webm') }, 'AUDIO_TOO_SMALL'],
    ['tiny video', { durationSeconds: 1, audioBlob: mediaBlob('audio/wav'), videoBlob: mediaBlob('video/webm', 20) }, 'VIDEO_TOO_SMALL'],
  ])('rejects $0', (_label, value, code) => {
    try {
      assertCompleteMedia(value)
      throw new Error('expected recording validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(RecordingValidationError)
      expect(error.code).toBe(code)
    }
  })

  test('returns normalized media metadata for a valid recording', () => {
    const audioBlob = mediaBlob('audio/wav')
    const videoBlob = mediaBlob('video/webm')

    expect(assertCompleteMedia({ durationSeconds: 1.25, audioBlob, videoBlob })).toEqual({
      durationSeconds: 1.25,
      audioBlob,
      videoBlob,
    })
  })

  test('exposes a stable error type for UI error mapping', () => {
    try {
      assertCompleteMedia({ durationSeconds: 0 })
    } catch (error) {
      expect(error).toBeInstanceOf(RecordingValidationError)
      expect(error.message).toBe('녹화 시간이 없어 분석을 시작할 수 없습니다.')
    }
  })
})
