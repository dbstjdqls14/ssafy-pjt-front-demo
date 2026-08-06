import { describe, expect, test, vi } from 'vitest'

import { useRecorder } from '../../src/composables/useRecorder.js'

class FakeMediaRecorder extends EventTarget {
  constructor() {
    super()
    this.state = 'inactive'
    this.mimeType = 'video/webm'
  }

  start() {
    this.state = 'recording'
  }

  pause() {
    queueMicrotask(() => {
      this.state = 'paused'
      this.dispatchEvent(new Event('pause'))
    })
  }

  resume() {
    queueMicrotask(() => {
      this.state = 'recording'
      this.dispatchEvent(new Event('resume'))
    })
  }

  stop() {
    this.state = 'inactive'
    this.dispatchEvent(new Event('stop'))
  }
}

describe('useRecorder media transitions', () => {
  test('resolves pause and resume only after MediaRecorder confirms the state change', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    const capture = useRecorder()
    capture.start({})

    const pausePromise = capture.pause()
    expect(capture.isPaused.value).toBe(false)
    await pausePromise
    expect(capture.isPaused.value).toBe(true)

    const resumePromise = capture.resume()
    expect(capture.isPaused.value).toBe(true)
    await resumePromise
    expect(capture.isPaused.value).toBe(false)
  })
})
