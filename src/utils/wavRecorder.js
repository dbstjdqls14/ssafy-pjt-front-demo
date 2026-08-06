const writeAscii = (view, offset, text) => {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index))
  }
}

const readAscii = (view, offset, length) => {
  let text = ''
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index))
  }
  return text
}

const concatSamples = (chunks, length) => {
  const result = new Float32Array(length)
  let offset = 0
  chunks.forEach((chunk) => {
    result.set(chunk, offset)
    offset += chunk.length
  })
  return result
}

const resampleLinear = (samples, sourceSampleRate, targetSampleRate) => {
  if (sourceSampleRate === targetSampleRate) return samples
  if (!samples.length) return new Float32Array()

  const targetLength = Math.max(1, Math.round(
    samples.length * targetSampleRate / sourceSampleRate,
  ))
  const result = new Float32Array(targetLength)
  const sourcePerTarget = sourceSampleRate / targetSampleRate

  for (let index = 0; index < targetLength; index += 1) {
    const position = index * sourcePerTarget
    const left = Math.min(Math.floor(position), samples.length - 1)
    const right = Math.min(left + 1, samples.length - 1)
    const fraction = position - left
    result[index] = samples[left] + (samples[right] - samples[left]) * fraction
  }

  return result
}

export const encodeMonoPcm16Wav = (samples, sampleRate = 16_000) => {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]))
    const pcm16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    view.setInt16(44 + index * 2, Math.round(pcm16), true)
  }

  return buffer
}

export const inspectWav = (buffer) => {
  const view = new DataView(buffer)
  const sampleRate = view.getUint32(24, true)
  const channels = view.getUint16(22, true)
  const bitsPerSample = view.getUint16(34, true)
  const dataBytes = view.getUint32(40, true)

  return {
    riff: readAscii(view, 0, 4),
    wave: readAscii(view, 8, 4),
    audioFormat: view.getUint16(20, true),
    channels,
    sampleRate,
    bitsPerSample,
    dataBytes,
    durationMs: Math.round(
      dataBytes / (sampleRate * channels * (bitsPerSample / 8)) * 1_000,
    ),
  }
}

export class PcmChunkAccumulator {
  constructor({
    sourceSampleRate,
    targetSampleRate = 16_000,
    chunkDurationMs = 10_000,
  }) {
    this.sourceSampleRate = sourceSampleRate
    this.targetSampleRate = targetSampleRate
    this.chunkDurationMs = chunkDurationMs
    this.chunkSampleCount = Math.round(sourceSampleRate * chunkDurationMs / 1_000)
    this.pendingChunks = []
    this.pendingLength = 0
    this.completeChunks = []
    this.completeLength = 0
    this.nextSequence = 0
  }

  append(input) {
    if (!input?.length) return []
    const samples = new Float32Array(input)
    this.pendingChunks.push(samples)
    this.pendingLength += samples.length
    this.completeChunks.push(samples)
    this.completeLength += samples.length

    const results = []
    while (this.pendingLength >= this.chunkSampleCount) {
      results.push(this.#createChunk(this.#takePending(this.chunkSampleCount)))
    }
    return results
  }

  flush() {
    if (!this.pendingLength) return null
    return this.#createChunk(this.#takePending(this.pendingLength))
  }

  toCompleteWav() {
    const source = concatSamples(this.completeChunks, this.completeLength)
    const resampled = resampleLinear(source, this.sourceSampleRate, this.targetSampleRate)
    return encodeMonoPcm16Wav(resampled, this.targetSampleRate)
  }

  get capturedDurationMs() {
    if (!Number.isFinite(this.sourceSampleRate) || this.sourceSampleRate <= 0) return 0
    return Math.round(this.completeLength / this.sourceSampleRate * 1_000)
  }

  #takePending(length) {
    const result = new Float32Array(length)
    let written = 0

    while (written < length) {
      const head = this.pendingChunks[0]
      const remaining = length - written
      const consumed = Math.min(head.length, remaining)
      result.set(head.subarray(0, consumed), written)
      written += consumed

      if (consumed === head.length) this.pendingChunks.shift()
      else this.pendingChunks[0] = head.slice(consumed)
      this.pendingLength -= consumed
    }

    return result
  }

  #createChunk(sourceSamples) {
    const sequence = this.nextSequence
    this.nextSequence += 1
    const resampled = resampleLinear(
      sourceSamples,
      this.sourceSampleRate,
      this.targetSampleRate,
    )

    return {
      sequence,
      timestamp: sequence * this.chunkDurationMs,
      durationMs: Math.round(sourceSamples.length / this.sourceSampleRate * 1_000),
      wav: encodeMonoPcm16Wav(resampled, this.targetSampleRate),
    }
  }
}
