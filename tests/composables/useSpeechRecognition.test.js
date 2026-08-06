import { afterEach, describe, expect, test, vi } from 'vitest'

import { useSpeechRecognition } from '../../src/composables/useSpeechRecognition.js'

class FakeSpeechRecognition {
  static instances = []

  constructor() {
    this.start = vi.fn()
    this.stop = vi.fn()
    this.abort = vi.fn()
    FakeSpeechRecognition.instances.push(this)
  }
}

describe('useSpeechRecognition', () => {
  afterEach(() => {
    vi.useRealTimers()
    delete window.SpeechRecognition
    FakeSpeechRecognition.instances = []
  })

  test('restarts the active browser recognition session after an unexpected end', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    const speech = useSpeechRecognition()

    speech.start()
    const instance = FakeSpeechRecognition.instances[0]
    expect(instance.start).toHaveBeenCalledTimes(1)

    instance.onend()

    expect(instance.start).toHaveBeenCalledTimes(2)
    expect(speech.isListening.value).toBe(true)
  })

  test('does not restart after an explicit stop', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    const speech = useSpeechRecognition()

    speech.start()
    const instance = FakeSpeechRecognition.instances[0]
    speech.stop()
    instance.onend()

    expect(instance.stop).toHaveBeenCalledTimes(1)
    expect(instance.start).toHaveBeenCalledTimes(1)
    expect(speech.isListening.value).toBe(false)
  })

  test('matches interview recognition options and concatenates every interim result', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    const speech = useSpeechRecognition()

    speech.start()
    const instance = FakeSpeechRecognition.instances[0]
    instance.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: '첫 문장' }], { isFinal: true }),
        Object.assign([{ transcript: '중간 하나' }], { isFinal: false }),
        Object.assign([{ transcript: '중간 둘' }], { isFinal: false }),
      ],
    })

    expect(instance.lang).toBe('ko-KR')
    expect(instance.continuous).toBe(true)
    expect(instance.interimResults).toBe(true)
    expect(speech.finalSegments.value).toEqual(['첫 문장'])
    expect(speech.interimText.value).toBe('중간 하나중간 둘')
  })

  test('pauses with abort and resumes the same recognition instance', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    const speech = useSpeechRecognition()

    speech.start()
    const instance = FakeSpeechRecognition.instances[0]
    speech.pause()
    instance.onend()
    speech.resume()

    expect(instance.abort).toHaveBeenCalledOnce()
    expect(instance.start).toHaveBeenCalledTimes(2)
    expect(FakeSpeechRecognition.instances).toHaveLength(1)
  })

  test('returns the visible transcript snapshot before stop clears interim text', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    const speech = useSpeechRecognition()
    speech.start()
    const instance = FakeSpeechRecognition.instances[0]
    instance.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript: '아직 확정되지 않은 문장' }], { isFinal: false })],
    })

    expect(speech.stop()).toBe('아직 확정되지 않은 문장')
    expect(speech.interimText.value).toBe('')
  })
})
