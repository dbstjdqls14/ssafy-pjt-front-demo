import { describe, expect, test, vi } from 'vitest'

import { useCaptureBridge } from '../../src/composables/useCaptureBridge.js'

const track = (kind) => ({ kind, stop: vi.fn() })

const liveSourceTrack = (kind) => {
  const source = { kind, readyState: 'live' }
  source.stop = vi.fn(() => {
    source.readyState = 'ended'
  })
  return source
}

const stream = (tracks) => ({
  getTracks: () => tracks,
  getVideoTracks: () => tracks.filter((item) => item.kind === 'video'),
  getAudioTracks: () => tracks.filter((item) => item.kind === 'audio'),
})

describe('useCaptureBridge', () => {
  test('같은 live source를 다시 연결해도 원본 카메라와 마이크 track을 종료하지 않는다', async () => {
    const outputVideo = track('video')
    const outputAudio = track('audio')
    const sourceNode = { connect: vi.fn(), disconnect: vi.fn() }
    const audioContext = {
      state: 'running',
      createMediaStreamDestination: () => ({ stream: stream([outputAudio]) }),
      createMediaStreamSource: vi.fn(() => sourceNode),
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
      close: vi.fn().mockResolvedValue(),
    }
    const documentRef = {
      createElement: (name) => (name === 'canvas'
        ? {
            width: 0,
            height: 0,
            getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
            captureStream: () => stream([outputVideo]),
          }
        : { srcObject: null, play: vi.fn().mockResolvedValue() }),
    }
    const video = liveSourceTrack('video')
    const audio = liveSourceTrack('audio')
    const bridge = useCaptureBridge({
      documentRef,
      audioContextFactory: () => audioContext,
      mediaStreamFactory: (tracks) => stream(tracks),
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
    })

    await bridge.connectVideoTrack(video)
    await bridge.connectAudioTrack(audio)
    await bridge.connectVideoTrack(video)
    await bridge.connectAudioTrack(audio)

    expect(video.readyState).toBe('live')
    expect(audio.readyState).toBe('live')
    expect(video.stop).not.toHaveBeenCalled()
    expect(audio.stop).not.toHaveBeenCalled()
    expect(audioContext.createMediaStreamSource).toHaveBeenCalledOnce()

    await bridge.dispose()
  })

  test('4:3 camera frames are centered without stretching in the 16:9 recorder canvas', async () => {
    const outputVideo = track('video')
    const outputAudio = track('audio')
    const context2d = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
    const videoElement = {
      muted: false,
      playsInline: false,
      srcObject: null,
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(),
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context2d,
      captureStream: () => stream([outputVideo]),
    }
    const gainNode = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
    const audioContext = {
      state: 'running',
      createMediaStreamDestination: () => ({ stream: stream([outputAudio]) }),
      createGain: () => gainNode,
      close: vi.fn().mockResolvedValue(),
    }
    const scheduledFrames = []
    const bridge = useCaptureBridge({
      documentRef: {
        createElement: (name) => (name === 'canvas' ? canvas : videoElement),
      },
      audioContextFactory: () => audioContext,
      mediaStreamFactory: (tracks) => stream(tracks),
      requestFrame: (callback) => {
        scheduledFrames.push(callback)
        return scheduledFrames.length
      },
      cancelFrame: vi.fn(),
    })

    await bridge.connectVideoTrack(track('video'))
    scheduledFrames.shift()()

    expect(context2d.drawImage).toHaveBeenCalledWith(videoElement, 160, 0, 960, 720)
    await bridge.dispose()
  })

  test('source를 교체하거나 bridge를 dispose해도 원본 track을 종료하지 않고 output identity를 유지한다', async () => {
    const outputVideo = track('video')
    const outputAudio = track('audio')
    const context2d = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
    const videoElement = { muted: false, playsInline: false, srcObject: null, play: vi.fn().mockResolvedValue() }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context2d,
      captureStream: () => stream([outputVideo]),
    }
    const destination = { stream: stream([outputAudio]) }
    const firstSourceNode = { connect: vi.fn(), disconnect: vi.fn() }
    const secondSourceNode = { connect: vi.fn(), disconnect: vi.fn() }
    const gainNode = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
    const audioContext = {
      state: 'running',
      createMediaStreamDestination: () => destination,
      createMediaStreamSource: vi.fn()
        .mockReturnValueOnce(firstSourceNode)
        .mockReturnValueOnce(secondSourceNode),
      createGain: () => gainNode,
      resume: vi.fn(),
      close: vi.fn().mockResolvedValue(),
    }
    const documentRef = {
      createElement: vi.fn((name) => (name === 'canvas' ? canvas : videoElement)),
    }
    const makeStream = (tracks) => stream(tracks)
    const firstVideo = liveSourceTrack('video')
    const secondVideo = liveSourceTrack('video')
    const firstAudio = liveSourceTrack('audio')
    const secondAudio = liveSourceTrack('audio')

    const bridge = useCaptureBridge({
      documentRef,
      audioContextFactory: () => audioContext,
      mediaStreamFactory: makeStream,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
    })
    const initialVideoOutput = bridge.outputStream.getVideoTracks()[0]
    const initialAudioOutput = bridge.outputStream.getAudioTracks()[0]

    await bridge.connectVideoTrack(firstVideo)
    await bridge.connectAudioTrack(firstAudio)
    bridge.disconnectVideo()
    bridge.disconnectAudio()
    await bridge.connectVideoTrack(secondVideo)
    await bridge.connectAudioTrack(secondAudio)

    expect(bridge.outputStream.getVideoTracks()[0]).toBe(initialVideoOutput)
    expect(bridge.outputStream.getAudioTracks()[0]).toBe(initialAudioOutput)
    expect(firstVideo.stop).not.toHaveBeenCalled()
    expect(firstAudio.stop).not.toHaveBeenCalled()
    expect(videoElement.srcObject.getVideoTracks()).toEqual([secondVideo])

    await bridge.dispose()
    expect(secondVideo.stop).not.toHaveBeenCalled()
    expect(secondAudio.stop).not.toHaveBeenCalled()
    expect(outputVideo.stop).toHaveBeenCalledOnce()
    expect(outputAudio.stop).toHaveBeenCalledOnce()
  })

  test('audio mute는 source를 끝내지 않고 고정 output에 무음을 보낸다', async () => {
    const outputVideo = track('video')
    const outputAudio = track('audio')
    const gainNode = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
    const sourceNode = { connect: vi.fn(), disconnect: vi.fn() }
    const audioContext = {
      state: 'running',
      createMediaStreamDestination: () => ({ stream: stream([outputAudio]) }),
      createMediaStreamSource: () => sourceNode,
      createGain: () => gainNode,
      close: vi.fn().mockResolvedValue(),
    }
    const documentRef = {
      createElement: (name) => (name === 'canvas'
        ? { width: 0, height: 0, getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }), captureStream: () => stream([outputVideo]) }
        : { srcObject: null, play: vi.fn().mockResolvedValue() }),
    }
    const audio = track('audio')
    const bridge = useCaptureBridge({
      documentRef,
      audioContextFactory: () => audioContext,
      mediaStreamFactory: (tracks) => stream(tracks),
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
    })

    await bridge.connectAudioTrack(audio)
    bridge.setAudioMuted(true)
    expect(gainNode.gain.value).toBe(0)
    expect(audio.stop).not.toHaveBeenCalled()
    bridge.setAudioMuted(false)
    expect(gainNode.gain.value).toBe(1)

    await bridge.dispose()
  })
})
