import { PcmChunkAccumulator } from '../utils/wavRecorder.js'

const defaultCreateAudioContext = () => {
  const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!AudioContext) throw new Error('이 브라우저는 PCM 오디오 수집을 지원하지 않습니다.')
  return new AudioContext({ sampleRate: 16_000 })
}

const defaultCreateMediaStream = (tracks) => new MediaStream(tracks)

export class PcmWavCapture {
  constructor({
    createAudioContext = defaultCreateAudioContext,
    createMediaStream = defaultCreateMediaStream,
    onChunk = null,
    onChunkError = null,
    maxRetries = 1,
  } = {}) {
    this.createAudioContext = createAudioContext
    this.createMediaStream = createMediaStream
    this.onChunk = onChunk
    this.onChunkError = onChunkError
    this.maxRetries = Math.max(0, Math.trunc(Number(maxRetries) || 0))
    this.context = null
    this.source = null
    this.processor = null
    this.silentGain = null
    this.accumulator = null
    this.chunks = []
    this.pending = []
    this.dispatchTail = Promise.resolve()
    this.running = false
    this.paused = false
    this.stopPromise = null
  }

  async start(stream) {
    if (this.running) return
    const audioTrack = stream?.getAudioTracks?.()[0]
    if (!audioTrack) throw new Error('녹음할 마이크 트랙이 없습니다.')

    this.context = this.createAudioContext()
    this.accumulator = new PcmChunkAccumulator({
      sourceSampleRate: this.context.sampleRate,
      targetSampleRate: 16_000,
      chunkDurationMs: 10_000,
    })
    this.source = this.context.createMediaStreamSource(
      this.createMediaStream([audioTrack]),
    )
    this.processor = this.context.createScriptProcessor(4_096, 1, 1)
    this.silentGain = this.context.createGain()
    this.silentGain.gain.value = 0

    this.processor.onaudioprocess = (event) => {
      if (!this.running || this.paused) return
      const samples = event.inputBuffer.getChannelData(0)
      this.accumulator.append(samples).forEach((chunk) => this.#dispatch(chunk))
    }

    this.source.connect(this.processor)
    this.processor.connect(this.silentGain)
    this.silentGain.connect(this.context.destination)
    if (this.context.state === 'suspended') await this.context.resume()
    this.running = true
    this.paused = false
  }

  pause() {
    if (this.running) this.paused = true
  }

  resume() {
    if (this.running) this.paused = false
  }

  getCapturedDurationMs() {
    return this.accumulator?.capturedDurationMs ?? 0
  }

  async flushCurrentChunk() {
    if (!this.accumulator || !this.running) return null
    const chunk = this.accumulator.flush()
    if (!chunk) return null
    return this.#dispatch(chunk)
  }

  stop() {
    if (this.stopPromise) return this.stopPromise
    if (!this.accumulator) {
      return Promise.resolve({ wavBlob: null, chunks: [] })
    }

    this.stopPromise = (async () => {
      this.running = false
      this.paused = false
      const finalChunk = this.accumulator.flush()
      if (finalChunk) this.#dispatch(finalChunk)
      const wavBlob = new Blob(
        [this.accumulator.toCompleteWav()],
        { type: 'audio/wav' },
      )

      try {
        await Promise.all(this.pending)
        return { wavBlob, chunks: this.chunks }
      } finally {
        this.processor.onaudioprocess = null
        this.source?.disconnect?.()
        this.processor?.disconnect?.()
        this.silentGain?.disconnect?.()
        await this.context?.close?.().catch(() => {})
      }
    })()

    return this.stopPromise
  }

  #dispatch(chunk) {
    const record = {
      ...chunk,
      blob: new Blob([chunk.wav], { type: 'audio/wav' }),
      analysis: null,
      error: null,
    }
    delete record.wav
    this.chunks.push(record)

    const request = this.dispatchTail.then(async () => {
      let lastError
      for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
        try {
          return await this.onChunk?.(record)
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    }).then((analysis) => {
      record.analysis = analysis ?? null
      return analysis
    }).catch((error) => {
      record.error = {
        message: error?.message || 'Audio analysis failed.',
        status: error?.status ?? null,
        code: error?.code ?? null,
      }
      try {
        this.onChunkError?.(error, record)
      } catch {
        // A status callback must never make the audio capture fail.
      }
      return null
    })
    this.dispatchTail = request.then(() => undefined)
    this.pending.push(request)
    return request
  }
}
