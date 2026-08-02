import { afterEach, describe, expect, test, vi } from 'vitest'

import { useSpeechRecognition } from '../../src/composables/useSpeechRecognition.js'

class FakeSpeechRecognition {
  static instances = []

  constructor() {
    this.start = vi.fn()
    this.stop = vi.fn()
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
})
