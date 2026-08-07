import { describe, expect, test } from 'vitest'

import { getStreamAspectRatio } from '../../src/composables/useMediaDevices.js'

const streamWithSettings = (settings) => ({
  getVideoTracks: () => [{ getSettings: () => settings }],
})

describe('getStreamAspectRatio', () => {
  test('uses the aspect ratio reported by the camera track', () => {
    expect(getStreamAspectRatio(streamWithSettings({ aspectRatio: 4 / 3 }))).toBeCloseTo(4 / 3)
  })

  test('derives the ratio from track dimensions when aspectRatio is absent', () => {
    expect(getStreamAspectRatio(streamWithSettings({ width: 1280, height: 720 }))).toBeCloseTo(16 / 9)
  })

  test('falls back safely when camera settings are unavailable or invalid', () => {
    expect(getStreamAspectRatio(null)).toBeCloseTo(16 / 9)
    expect(getStreamAspectRatio(streamWithSettings({ aspectRatio: 0 }))).toBeCloseTo(16 / 9)
  })
})
