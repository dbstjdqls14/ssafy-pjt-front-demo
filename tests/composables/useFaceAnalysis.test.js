import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const visionMocks = vi.hoisted(() => ({
  detectForVideo: vi.fn(),
}))

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn().mockResolvedValue({}),
  },
  FaceLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue({
      detectForVideo: visionMocks.detectForVideo,
      close: vi.fn(),
    }),
  },
}))

import { useFaceAnalysis } from '../../src/composables/useFaceAnalysis.js'

const faceResult = ({ horizontal = 0, up = 0, down = 0 } = {}) => {
  const landmarks = []
  landmarks[33] = { x: 0.3, y: 0.4 }
  landmarks[263] = { x: 0.7, y: 0.4 }
  landmarks[1] = { x: 0.5, y: 0.6 }

  return {
    faceLandmarks: [landmarks],
    faceBlendshapes: [{
      categories: [
        { categoryName: 'eyeLookOutLeft', score: horizontal },
        { categoryName: 'eyeLookInRight', score: horizontal },
        { categoryName: 'eyeLookInLeft', score: 0 },
        { categoryName: 'eyeLookOutRight', score: 0 },
        { categoryName: 'eyeLookUpLeft', score: up },
        { categoryName: 'eyeLookUpRight', score: up },
        { categoryName: 'eyeLookDownLeft', score: down },
        { categoryName: 'eyeLookDownRight', score: down },
      ],
    }],
  }
}

const runSamples = async (samples) => {
  const sampleCount = samples.length
  const scope = effectScope()
  let analysis
  scope.run(() => {
    analysis = useFaceAnalysis()
  })

  const video = {
    readyState: 2,
    videoWidth: 1_000,
    videoHeight: 1_000,
    currentTime: 0,
  }
  visionMocks.detectForVideo.mockReset()
  visionMocks.detectForVideo.mockImplementation(() => samples.shift() ?? faceResult())

  await analysis.start(video)
  for (let index = 0; index < sampleCount; index += 1) {
    video.currentTime = (index + 1) * 0.3
    vi.advanceTimersByTime(300)
  }

  return { analysis, scope }
}

describe('useFaceAnalysis', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the nonverbal summary contract used by interview completion', () => {
    const scope = effectScope()
    let analysis

    scope.run(() => {
      analysis = useFaceAnalysis()
    })

    expect(analysis.getSessionSummary()).toEqual({
      gazeDeviationCount: 0,
      gazeEvents: [],
      tiltBuckets: [],
    })
    expect(analysis.getSessionSummary()).not.toHaveProperty('gazeStablePercent')
    expect(analysis.gazeFrontal.value).toBeNull()
    expect(analysis.postureTilted.value).toBeNull()
    expect(analysis.prepare).toBeTypeOf('function')
    expect(analysis.resume).toBeTypeOf('function')

    scope.stop()
  })

  it('ignores a single 300ms side-glance sample between frontal samples', async () => {
    vi.useFakeTimers()
    const { analysis, scope } = await runSamples([
      faceResult(),
      faceResult({ horizontal: 0.8 }),
      faceResult(),
    ])

    expect(analysis.getSessionSummary().gazeDeviationCount).toBe(0)

    scope.stop()
  })

  it('keeps moderate eye movement inside the relaxed frontal range', async () => {
    vi.useFakeTimers()
    const { analysis, scope } = await runSamples([
      faceResult(),
      faceResult({ horizontal: 0.36 }),
      faceResult({ horizontal: 0.36 }),
    ])

    expect(analysis.getSessionSummary().gazeDeviationCount).toBe(0)

    scope.stop()
  })

  it('counts two consecutive strong side-glance samples as one deviation', async () => {
    vi.useFakeTimers()
    const { analysis, scope } = await runSamples([
      faceResult(),
      faceResult({ horizontal: 0.8 }),
      faceResult({ horizontal: 0.8 }),
    ])

    expect(analysis.getSessionSummary().gazeDeviationCount).toBe(1)
    expect(analysis.getSessionSummary().gazeEvents).toHaveLength(1)

    scope.stop()
  })
})
