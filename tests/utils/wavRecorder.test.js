import { describe, expect, it } from 'vitest'

import {
  PcmChunkAccumulator,
  encodeMonoPcm16Wav,
  inspectWav,
} from '../../src/utils/wavRecorder.js'

const constantSamples = (length, value = 0.25) => {
  const samples = new Float32Array(length)
  samples.fill(value)
  return samples
}

describe('WAV encoding', () => {
  it('writes a 16 kHz mono 16-bit PCM RIFF header', () => {
    const wav = encodeMonoPcm16Wav(constantSamples(16_000), 16_000)
    const info = inspectWav(wav)

    expect(info).toEqual({
      riff: 'RIFF',
      wave: 'WAVE',
      audioFormat: 1,
      channels: 1,
      sampleRate: 16_000,
      bitsPerSample: 16,
      dataBytes: 32_000,
      durationMs: 1_000,
    })
    expect(wav.byteLength).toBe(44 + 32_000)
  })
})

describe('10-second PCM chunk accumulation', () => {
  it('emits exact ten-second chunks with zero-based sequences', () => {
    const recorder = new PcmChunkAccumulator({
      sourceSampleRate: 48_000,
      targetSampleRate: 16_000,
      chunkDurationMs: 10_000,
    })

    expect(recorder.append(constantSamples(48_000 * 6))).toEqual([])
    const chunks = recorder.append(constantSamples(48_000 * 5))

    expect(chunks).toHaveLength(1)
    expect(chunks[0].sequence).toBe(0)
    expect(chunks[0].timestamp).toBe(0)
    expect(chunks[0].durationMs).toBe(10_000)
    expect(inspectWav(chunks[0].wav)).toMatchObject({
      sampleRate: 16_000,
      channels: 1,
      dataBytes: 16_000 * 10 * 2,
      durationMs: 10_000,
    })
  })

  it('flushes the final short chunk and preserves the complete WAV', () => {
    const recorder = new PcmChunkAccumulator({
      sourceSampleRate: 16_000,
      targetSampleRate: 16_000,
      chunkDurationMs: 10_000,
    })

    recorder.append(constantSamples(16_000 * 10))
    recorder.append(constantSamples(16_000 * 3))
    const finalChunk = recorder.flush()
    const completeWav = recorder.toCompleteWav()

    expect(finalChunk).toMatchObject({
      sequence: 1,
      timestamp: 10_000,
      durationMs: 3_000,
    })
    expect(inspectWav(finalChunk.wav).durationMs).toBe(3_000)
    expect(inspectWav(completeWav).durationMs).toBe(13_000)
    expect(recorder.flush()).toBeNull()
  })
})
