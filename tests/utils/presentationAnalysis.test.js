import { describe, expect, test } from 'vitest'

import {
  calculateWpm,
  countFillerWords,
} from '../../src/composables/useRealtimePresentationAnalysis.js'
import * as realtimeAnalysis from '../../src/composables/useRealtimePresentationAnalysis.js'
import {
  scoreFaceAlignment,
  scorePosture,
} from '../../src/services/presentationVisionService.js'
import {
  MAX_PRESENTATION_FILE_SIZE,
  validatePresentationFile,
} from '../../src/utils/presentationFiles.js'

describe('presentation file validation', () => {
  test('accepts PDF/PPTX and rejects unsupported or oversized files', () => {
    expect(validatePresentationFile(new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }))).toBe('')
    expect(validatePresentationFile(new File(['pptx'], 'deck.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }))).toBe('')
    expect(validatePresentationFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toContain('PDF 또는 PPTX')

    const oversized = { name: 'huge.pdf', type: 'application/pdf', size: MAX_PRESENTATION_FILE_SIZE + 1 }
    expect(validatePresentationFile(oversized)).toContain('100MB')
  })
})

describe('realtime speech metrics', () => {
  test('calculates WPM from transcript and elapsed time', () => {
    expect(calculateWpm('하나 둘 셋 넷 다섯 여섯', 30)).toBe(12)
    expect(calculateWpm('짧음', 2)).toBeNull()
  })

  test('counts configured Korean filler words', () => {
    expect(countFillerWords('음, 그러니까 이 기능은 어 좋은 기능입니다.')).toBe(3)
  })

  test('uses a rolling window so recent gaze loss is not hidden by old good samples', () => {
    const samples = [
      ...Array.from({ length: 100 }, () => 95),
      ...Array.from({ length: 10 }, () => 20),
    ]

    expect(realtimeAnalysis.calculateGazeHold?.(samples, {
      threshold: 70,
      windowSize: 20,
    })).toBe(50)
  })

  test('uses a rolling window so recent posture changes are visible', () => {
    const samples = [
      ...Array.from({ length: 100 }, () => 100),
      ...Array.from({ length: 10 }, () => 20),
    ]

    expect(realtimeAnalysis.calculatePostureAverage?.(samples, {
      windowSize: 20,
    })).toBe(60)
  })
})

describe('MediaPipe landmark scoring', () => {
  test('returns a high gaze score when irises and head are centered', () => {
    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
    landmarks[33] = { x: 0.3, y: 0.45 }
    landmarks[133] = { x: 0.42, y: 0.45 }
    landmarks[468] = { x: 0.36, y: 0.45 }
    landmarks[362] = { x: 0.58, y: 0.45 }
    landmarks[263] = { x: 0.7, y: 0.45 }
    landmarks[473] = { x: 0.64, y: 0.45 }
    landmarks[1] = { x: 0.5, y: 0.52 }

    expect(scoreFaceAlignment(landmarks)).toBeGreaterThanOrEqual(95)
  })

  test('drops the gaze score when MediaPipe eye-look blendshapes detect a side glance', () => {
    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
    landmarks[33] = { x: 0.3, y: 0.45 }
    landmarks[133] = { x: 0.42, y: 0.45 }
    landmarks[468] = { x: 0.36, y: 0.45 }
    landmarks[362] = { x: 0.58, y: 0.45 }
    landmarks[263] = { x: 0.7, y: 0.45 }
    landmarks[473] = { x: 0.64, y: 0.45 }
    landmarks[1] = { x: 0.5, y: 0.52 }
    const blendshapes = [
      { categoryName: 'eyeLookOutLeft', score: 0.8 },
      { categoryName: 'eyeLookInRight', score: 0.8 },
    ]

    expect(scoreFaceAlignment(landmarks, blendshapes)).toBeLessThan(70)
  })

  test('returns a high posture score for level shoulders and centered hips', () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
    landmarks[11] = { x: 0.4, y: 0.4, visibility: 1 }
    landmarks[12] = { x: 0.6, y: 0.4, visibility: 1 }
    landmarks[23] = { x: 0.42, y: 0.7, visibility: 1 }
    landmarks[24] = { x: 0.58, y: 0.7, visibility: 1 }

    expect(scorePosture(landmarks)).toBeGreaterThanOrEqual(95)
  })

  test('scores an upper-body frame when hips are cropped and corrects for video aspect ratio', () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }))
    landmarks[11] = { x: 0.4, y: 0.4, visibility: 0.95 }
    landmarks[12] = { x: 0.6, y: 0.42, visibility: 0.95 }
    landmarks[23] = { x: 0.42, y: 0.7, visibility: 0.05 }
    landmarks[24] = { x: 0.58, y: 0.7, visibility: 0.05 }

    const widescreenScore = scorePosture(landmarks, 16 / 9)

    expect(widescreenScore).not.toBeNull()
    expect(widescreenScore).toBeGreaterThanOrEqual(85)
    expect(widescreenScore).toBeGreaterThan(scorePosture(landmarks, 1))
  })
})
