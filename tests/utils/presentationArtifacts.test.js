import { describe, expect, it } from 'vitest'

import {
  PresentationDetectionAccumulator,
  buildSlideVisitText,
  toInterviewAlignedDetectionSample,
} from '../../src/utils/presentationArtifacts.js'

describe('presentation text artifact', () => {
  it('keeps repeated visits to the same slide as separate entries', () => {
    const text = buildSlideVisitText({
      slides: [
        { id: 11, number: 1 },
        { id: 12, number: 2 },
      ],
      visits: [
        { slideId: 11, startedAtMs: 0, endedAtMs: 18_342 },
        { slideId: 12, startedAtMs: 18_342, endedAtMs: 18_888 },
        { slideId: 11, startedAtMs: 18_888, endedAtMs: 30_000 },
      ],
      transcripts: [
        { text: '안녕하세요.', atMs: 2_000 },
        { text: '두 번째 슬라이드입니다.', atMs: 18_500 },
        { text: '첫 번째 슬라이드로 돌아왔습니다.', atMs: 22_000 },
      ],
    })

    expect(text).toEqual([
      { page: 1, timestamp: 0, content: '안녕하세요.' },
      { page: 2, timestamp: 18_342, content: '두 번째 슬라이드입니다.' },
      { page: 1, timestamp: 18_888, content: '첫 번째 슬라이드로 돌아왔습니다.' },
    ])
  })
})

describe('presentation detects artifact', () => {
  it('groups body stability and side-glance transitions into ten-second windows', () => {
    const detects = new PresentationDetectionAccumulator()

    detects.add({ timestamp: 0, postureScore: 90, gazeScore: 90 })
    detects.add({ timestamp: 2_400, postureScore: 45, gazeScore: 90 })
    detects.add({ timestamp: 3_200, postureScore: 50, gazeScore: 50 })
    detects.add({ timestamp: 4_000, postureScore: 48, gazeScore: 45 })
    detects.add({ timestamp: 5_000, postureScore: 80, gazeScore: 85 })
    detects.add({ timestamp: 6_800, postureScore: 40, gazeScore: 90 })
    detects.add({ timestamp: 7_400, postureScore: 75, gazeScore: 40 })
    detects.add({ timestamp: 10_000, postureScore: 70, gazeScore: 90 })
    detects.add({ timestamp: 12_600, postureScore: 40, gazeScore: 90 })
    detects.add({ timestamp: 15_300, postureScore: 80, gazeScore: 30 })

    expect(detects.finish(20_000)).toEqual([
      {
        timestamp: 0,
        sequence: 0,
        bodyStability: {
          average: 61.1,
          outlierList: [2_400, 6_800],
        },
        sideGlance: [3_200, 7_400],
      },
      {
        timestamp: 10_000,
        sequence: 1,
        bodyStability: {
          average: 63.3,
          outlierList: [12_600],
        },
        sideGlance: [15_300],
      },
    ])
  })

  it('builds the complete nonverbal DTO from measured samples', () => {
    const accumulator = new PresentationDetectionAccumulator()

    accumulator.add({ timestamp: 0, postureScore: 100, gazeScore: 100, faceDetected: true })
    accumulator.add({ timestamp: 2_000, postureScore: 0, gazeScore: 0, faceDetected: true })
    accumulator.add({ timestamp: 4_000, postureScore: 0, gazeScore: 0, faceDetected: true })
    accumulator.add({ timestamp: 12_000, postureScore: 100, gazeScore: 100, faceDetected: true })

    expect(accumulator.finishNonverbal(20_000)).toEqual({
      gazeDeviationCount: 1,
      postureTiltPercent: 50,
      sampleCount: 4,
      gazeEvents: [{ atSec: 2 }],
      tiltBuckets: [
        { startSec: 0, endSec: 10, tiltPct: 66.7 },
        { startSec: 10, endSec: 20, tiltPct: 0 },
      ],
    })
  })
})

describe('interview-aligned presentation detection sample', () => {
  it('maps the interview face-analysis state to the presentation contract', () => {
    expect(
      toInterviewAlignedDetectionSample({
        faceDetected: true,
        gazeFrontal: true,
        postureTilted: false,
      }),
    ).toEqual({
      postureScore: 100,
      gazeScore: 100,
      poseDetected: true,
      faceDetected: true,
    })

    expect(
      toInterviewAlignedDetectionSample({
        faceDetected: true,
        gazeFrontal: false,
        postureTilted: true,
      }),
    ).toEqual({
      postureScore: 0,
      gazeScore: 0,
      poseDetected: true,
      faceDetected: true,
    })
  })

  it('waits until the interview analyser has produced its first state', () => {
    expect(
      toInterviewAlignedDetectionSample({
        faceDetected: false,
        gazeFrontal: null,
        postureTilted: null,
      }),
    ).toBeNull()
  })
})
