import { describe, expect, test } from 'vitest'

import { buildQuestionPlaybackTimeline, questionIndexAtTime } from '../../src/utils/interviewTimeline.js'

describe('questionIndexAtTime', () => {
  const questions = [
    { startSec: 0, durationSec: 10 },
    { startSec: 10, durationSec: 20 },
    { startSec: 30, durationSec: 15 },
  ]

  test('returns the question containing the current absolute video time', () => {
    expect(questionIndexAtTime(questions, 0)).toBe(0)
    expect(questionIndexAtTime(questions, 9.9)).toBe(0)
    expect(questionIndexAtTime(questions, 10)).toBe(1)
    expect(questionIndexAtTime(questions, 29.9)).toBe(1)
    expect(questionIndexAtTime(questions, 30)).toBe(2)
  })

  test('clamps times outside the recording to the first or last question', () => {
    expect(questionIndexAtTime(questions, -5)).toBe(0)
    expect(questionIndexAtTime(questions, 999)).toBe(2)
    expect(questionIndexAtTime([], 10)).toBe(0)
  })

  test('does not let analysis events override the canonical question boundary', () => {
    const questions = [
      { startSec: 0, durationSec: 5 },
      { startSec: 5, durationSec: 8 },
      { startSec: 13, durationSec: 4 },
    ]
    const analysisEvents = [{ atSec: 6, questionIndex: 2 }]

    expect(questionIndexAtTime(questions, 7, analysisEvents)).toBe(1)
  })
})

describe('buildQuestionPlaybackTimeline', () => {
  test('compacts TTS gaps and uses actual answer durations for the stitched video', () => {
    const timeline = buildQuestionPlaybackTimeline([
      { rawStartSec: 0, rawEndSec: 5, durationSec: 8 },
      { rawStartSec: 8, rawEndSec: 13, durationSec: 9 },
      { rawStartSec: 17, rawEndSec: 21, durationSec: 4 },
    ], 14)

    expect(timeline.map(({ startSec, durationSec }) => ({ startSec, durationSec }))).toEqual([
      { startSec: 0, durationSec: 5 },
      { startSec: 5, durationSec: 5 },
      { startSec: 10, durationSec: 4 },
    ])
    expect(questionIndexAtTime(timeline, 11)).toBe(2)
  })

  test('does not stretch answer boundaries to include recorder timestamp gaps', () => {
    const timeline = buildQuestionPlaybackTimeline([
      { rawStartSec: 0, rawEndSec: 4, durationSec: 4 },
      { rawStartSec: 6, rawEndSec: 10, durationSec: 4 },
    ], 10)

    expect(timeline[0].durationSec).toBe(4)
    expect(timeline[1].startSec).toBe(4)
    expect(timeline[1].durationSec).toBe(4)
  })

  test('fits every question inside the real stitched media even when server durations differ greatly', () => {
    const timeline = buildQuestionPlaybackTimeline([
      { rawStartSec: 0, rawEndSec: 5 },
      { rawStartSec: 8, rawEndSec: 13 },
      { rawStartSec: 17, rawEndSec: 21 },
    ], 3.778399)

    const finalQuestion = timeline[2]
    const timelineEnd = finalQuestion.startSec + finalQuestion.durationSec

    expect(finalQuestion.startSec).toBeLessThan(3.778399)
    expect(timelineEnd).toBeCloseTo(3.778399, 6)
    expect(questionIndexAtTime(timeline, finalQuestion.startSec)).toBe(2)
  })

  test('does not map unanswered or audio-less questions onto the stitched video', () => {
    const timeline = buildQuestionPlaybackTimeline([
      { answer: 'first answer', rawStartSec: 0, rawEndSec: 5, isVideoMapped: true },
      { answer: '', rawStartSec: 5, rawEndSec: 8, isVideoMapped: false },
      { answer: 'third answer', rawStartSec: 8, rawEndSec: 12, isVideoMapped: true },
      { answer: 'text only', rawStartSec: 12, rawEndSec: 12, isVideoMapped: false },
    ], 9)

    expect(timeline[1]).toMatchObject({
      startSec: null,
      durationSec: 0,
      isVideoMapped: false,
    })
    expect(timeline[2]).toMatchObject({
      startSec: 5,
      durationSec: 4,
      isVideoMapped: true,
    })
    expect(timeline[3]).toMatchObject({
      startSec: null,
      durationSec: 0,
      isVideoMapped: false,
    })
    expect(questionIndexAtTime(timeline, 5.5)).toBe(2)
  })

  test('skips a zero-duration question when resolving the active video question', () => {
    const timeline = [
      { startSec: 0, durationSec: 5, isVideoMapped: true },
      { startSec: null, durationSec: 0, isVideoMapped: false },
    ]

    expect(questionIndexAtTime(timeline, 5)).toBe(0)
  })
})
