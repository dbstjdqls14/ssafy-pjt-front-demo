import { afterEach, describe, expect, test, vi } from 'vitest'

import { getStreamAspectRatio, useMediaDevices } from '../../src/composables/useMediaDevices.js'

const originalMediaDevices = navigator.mediaDevices

const fakeTrack = (kind) => {
  const listeners = new Map()
  return {
    kind,
    readyState: 'live',
    stop: vi.fn(),
    addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    removeEventListener: vi.fn((name) => listeners.delete(name)),
    endExternally() {
      this.readyState = 'ended'
      listeners.get('ended')?.()
    },
  }
}

const fakeStream = ({ video = [], audio = [] } = {}) => ({
  getTracks: () => [...video, ...audio],
  getVideoTracks: () => video,
  getAudioTracks: () => audio,
})

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: originalMediaDevices,
  })
  vi.restoreAllMocks()
})

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

describe('useMediaDevices', () => {
  test('stops a camera track that resolves after the composable was disposed', async () => {
    const videoTrack = fakeTrack('video')
    let resolveRequest
    const pendingStream = new Promise((resolve) => {
      resolveRequest = resolve
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockReturnValue(pendingStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })

    const media = useMediaDevices()
    const request = media.requestVideo()
    media.dispose()
    resolveRequest(fakeStream({ video: [videoTrack] }))

    await expect(request).resolves.toBeNull()
    expect(videoTrack.stop).toHaveBeenCalledOnce()
    expect(media.videoTrack.value).toBeNull()
    expect(media.stream.value).toBeNull()
  })

  test('audio 요청 실패 후에도 granted video track을 유지한다', async () => {
    const videoTrack = fakeTrack('video')
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce(fakeStream({ video: [videoTrack] }))
      .mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    })

    const media = useMediaDevices()
    await media.requestVideo()
    await expect(media.requestAudio()).rejects.toThrow('denied')

    expect(media.videoState.value).toBe('granted')
    expect(media.audioState.value).toBe('denied')
    expect(media.stream.value.getVideoTracks()).toEqual([videoTrack])
    expect(videoTrack.stop).not.toHaveBeenCalled()
    media.stopStream()
  })

  test('releaseAudio stops only the audio source track', async () => {
    const videoTrack = fakeTrack('video')
    const audioTrack = fakeTrack('audio')
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce(fakeStream({ video: [videoTrack] }))
      .mockResolvedValueOnce(fakeStream({ audio: [audioTrack] }))
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    })

    const media = useMediaDevices()
    await media.requestVideo()
    await media.requestAudio()
    media.releaseAudio()

    expect(audioTrack.stop).toHaveBeenCalledOnce()
    expect(videoTrack.stop).not.toHaveBeenCalled()
    expect(media.audioState.value).toBe('idle')
    expect(media.videoState.value).toBe('granted')
    expect(media.stream.value.getAudioTracks()).toEqual([])
    media.stopStream()
  })

  test('reports an externally ended required track once', async () => {
    const videoTrack = fakeTrack('video')
    const onRequiredDeviceLost = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(fakeStream({ video: [videoTrack] })),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })

    const media = useMediaDevices({ onRequiredDeviceLost })
    await media.requestVideo()
    videoTrack.endExternally()
    videoTrack.endExternally()

    expect(media.videoState.value).toBe('ended')
    expect(onRequiredDeviceLost).toHaveBeenCalledOnce()
    expect(onRequiredDeviceLost).toHaveBeenCalledWith({ kind: 'video', reason: 'ended' })
    expect(media.stream.value).toBeNull()
    media.stopStream()
  })
})
