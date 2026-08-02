import { describe, expect, test, vi } from 'vitest'

import { PcmWavCapture } from '../../src/services/pcmWavCapture.js'
import { inspectWav } from '../../src/utils/wavRecorder.js'

const node = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
})

const createAudioContext = () => {
  const source = node()
  const processor = { ...node(), onaudioprocess: null }
  const gain = { ...node(), gain: { value: 1 } }
  const context = {
    sampleRate: 16_000,
    state: 'running',
    destination: {},
    createMediaStreamSource: vi.fn(() => source),
    createScriptProcessor: vi.fn(() => processor),
    createGain: vi.fn(() => gain),
    resume: vi.fn().mockResolvedValue(),
    close: vi.fn().mockResolvedValue(),
  }
  return { context, source, processor, gain }
}

describe('PcmWavCapture', () => {
  test('uploads every generated chunk and waits for the final short chunk', async () => {
    const fake = createAudioContext()
    const onChunk = vi.fn().mockImplementation(async (chunk) => ({ sequence: chunk.sequence }))
    const capture = new PcmWavCapture({
      createAudioContext: () => fake.context,
      createMediaStream: () => ({ audioOnly: true }),
      onChunk,
    })

    await capture.start({ getAudioTracks: () => [{ id: 'mic' }] })
    fake.processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(16_000 * 10) },
    })
    fake.processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(16_000 * 2) },
    })
    const result = await capture.stop()

    expect(onChunk).toHaveBeenCalledTimes(2)
    expect(onChunk.mock.calls.map(([chunk]) => chunk.sequence)).toEqual([0, 1])
    expect(onChunk.mock.calls.map(([chunk]) => chunk.durationMs)).toEqual([10_000, 2_000])
    expect(result.chunks.map((chunk) => chunk.analysis)).toEqual([
      { sequence: 0 },
      { sequence: 1 },
    ])
    expect(result.wavBlob.type).toBe('audio/wav')
    expect(inspectWav(await result.wavBlob.arrayBuffer()).durationMs).toBe(12_000)
    expect(fake.context.close).toHaveBeenCalled()
  })

  test('does not accumulate samples while paused', async () => {
    const fake = createAudioContext()
    const capture = new PcmWavCapture({
      createAudioContext: () => fake.context,
      createMediaStream: () => ({ audioOnly: true }),
    })

    await capture.start({ getAudioTracks: () => [{ id: 'mic' }] })
    capture.pause()
    fake.processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(16_000) },
    })
    capture.resume()
    fake.processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(16_000) },
    })
    const result = await capture.stop()

    expect(inspectWav(await result.wavBlob.arrayBuffer()).durationMs).toBe(1_000)
  })

  test('keeps the complete WAV and resolves stop when a chunk analysis request fails', async () => {
    const fake = createAudioContext()
    const failure = Object.assign(new Error('Audio analysis failed.'), {
      status: 502,
      code: '50201',
    })
    const onChunkError = vi.fn()
    const capture = new PcmWavCapture({
      createAudioContext: () => fake.context,
      createMediaStream: () => ({ audioOnly: true }),
      onChunk: vi.fn().mockRejectedValue(failure),
      onChunkError,
    })

    await capture.start({ getAudioTracks: () => [{ id: 'mic' }] })
    fake.processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(16_000) },
    })

    const result = await capture.stop()

    expect(inspectWav(await result.wavBlob.arrayBuffer()).durationMs).toBe(1_000)
    expect(result.chunks[0].error).toMatchObject({
      message: 'Audio analysis failed.',
      status: 502,
      code: '50201',
    })
    expect(onChunkError).toHaveBeenCalledWith(failure, expect.objectContaining({ sequence: 0 }))
  })

  test('sends chunks in FIFO order and retries a failed analysis once', async () => {
    const fake = createAudioContext()
    const failure = new Error('temporary failure')
    let rejectFirstAttempt
    const firstAttempt = new Promise((resolve, reject) => {
      rejectFirstAttempt = reject
    })
    const onChunk = vi.fn()
      .mockImplementationOnce(() => firstAttempt)
      .mockResolvedValueOnce({ sequence: 0, retried: true })
      .mockResolvedValueOnce({ sequence: 1 })
    const capture = new PcmWavCapture({
      createAudioContext: () => fake.context,
      createMediaStream: () => ({ audioOnly: true }),
      onChunk,
    })

    await capture.start({ getAudioTracks: () => [{ id: 'mic' }] })
    fake.processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(16_000 * 20) },
    })
    await Promise.resolve()

    expect(onChunk).toHaveBeenCalledTimes(1)
    expect(onChunk.mock.calls[0][0].sequence).toBe(0)

    rejectFirstAttempt(failure)
    const result = await capture.stop()

    expect(onChunk.mock.calls.map(([chunk]) => chunk.sequence)).toEqual([0, 0, 1])
    expect(result.chunks.map((chunk) => chunk.analysis)).toEqual([
      { sequence: 0, retried: true },
      { sequence: 1 },
    ])
    expect(result.chunks.every((chunk) => chunk.error === null)).toBe(true)
  })
})
