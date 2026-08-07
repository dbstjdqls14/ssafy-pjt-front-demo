import { describe, expect, it } from 'vitest'

import { normalizePresentationReport } from '../../src/api/normalizers/presentationReport.js'

const response = {
  status: 'COMPLETED',
  practice: {
    practiceId: 35,
    title: 'AIVO 서비스 소개 발표',
    description: '주요 기능 소개',
    practicedAt: '2026-07-20T14:32:00',
    durationSec: 22,
  },
  presentation: {
    presentationId: 12,
    targetDurationSec: 300,
    aiQnaEnabled: true,
    slideCount: 2,
  },
  score: {
    overallScore: 91,
    folderAverageScore: 84.3,
    folderAverageDelta: 6.7,
    contentScore: 91,
    voiceScore: 93,
    videoScore: 87,
    questionAnswerScore: 84,
  },
  media: {
    video: { videoId: 52, playbackUrl: 'https://example.com/presentations/12/video' },
    audio: { audioId: 51, contentType: 'audio/wav' },
  },
  audioStt: {
    audioSttId: 71,
    content: '첫 슬라이드 두 번째 슬라이드',
    segments: [
      { text: '첫 슬라이드', startTimeMs: 800, endTimeMs: 4_200, slideId: 101 },
      { text: '두 번째 슬라이드', startTimeMs: 13_200, endTimeMs: 18_700, slideId: 102 },
    ],
  },
  speechAnalysis: {
    averageWpm: 134,
    totalFillerCount: 3,
    fillerBreakdown: [['음', 1], ['아', 1], ['어', 1]],
    totalSilenceDurationMs: 2_300,
    windows: [
      {
        logId: 301,
        startTimeMs: 0,
        endTimeMs: 10_000,
        averageWpm: 118,
        fillerCount: 2,
        fillerEvents: [
          { word: '음', atSec: 4 },
          { word: '아', atSec: 7 },
        ],
        silenceDetected: true,
        silenceDurationMs: 2_300,
      },
      {
        logId: 302,
        startTimeMs: 10_000,
        endTimeMs: 20_000,
        averageWpm: 139,
        fillerCount: 1,
        fillerEvents: [{ word: '어', atSec: 15 }],
        silenceDetected: false,
        silenceDurationMs: 0,
      },
    ],
  },
  slides: [
    {
      slideId: 101,
      slideNumber: 1,
      imageUrl: '/slides/1.png',
      coreContent: '서비스 목적',
      startTimeSec: 0,
      endTimeSec: 12,
      feedback: { feedbackId: 501, score: 88, content: '목적을 명확하게 설명했습니다.' },
    },
    {
      slideId: 102,
      slideNumber: 2,
      imageUrl: '/slides/2.png',
      coreContent: '핵심 기능',
      startTimeSec: 12,
      endTimeSec: 22,
      feedback: { feedbackId: 502, score: 91, content: '기능을 명확하게 설명했습니다.' },
    },
  ],
  questionAnswers: [
    {
      questionId: 201,
      question: '차별점은 무엇인가요?',
      modelAnswer: '통합 분석입니다.',
      userAnswer: '음성과 자세를 함께 분석합니다.',
      feedback: { feedbackId: 601, score: 84, content: '비교 근거를 보완하세요.' },
    },
  ],
}

describe('normalizePresentationReport', () => {
  it('keeps the presentation report domain shape without visit data', () => {
    const report = normalizePresentationReport(response)

    expect(report.practice).toMatchObject({
      practiceId: 35,
      title: 'AIVO 서비스 소개 발표',
      durationSec: 22,
    })
    expect(report.presentation).toMatchObject({ presentationId: 12, slideCount: 2 })
    expect(report.score).toMatchObject({
      overallScore: 91,
      voiceScore: 93,
      videoScore: 87,
      contentScore: 91,
    })
    expect(report.slides[0]).toMatchObject({
      slideId: 101,
      startTimeSec: 0,
      endTimeSec: 12,
      durationSec: 12,
    })
    expect(report.slides[0]).not.toHaveProperty('visits')
    expect(report.slides[0]).not.toHaveProperty('ranges')
    expect(JSON.stringify(report)).not.toContain('visitId')
    expect(report.slides[0].feedback.content).toBe('목적을 명확하게 설명했습니다.')
    expect(report.questionAnswers[0].feedback.score).toBe(84)
  })

  it('clips speech windows and transcripts into slide-local time', () => {
    const report = normalizePresentationReport(response)

    expect(report.slides[0].speech.buckets).toEqual([
      expect.objectContaining({ startSec: 0, endSec: 10, averageWpm: 118 }),
      expect.objectContaining({ startSec: 10, endSec: 12, averageWpm: 139 }),
    ])
    expect(report.slides[1].speech.buckets[0]).toMatchObject({
      startSec: 0,
      endSec: 8,
      averageWpm: 139,
      fillerCount: 0,
      silenceDetected: false,
    })
    expect(report.slides[0].speech.totalFillerCount).toBe(3)
    expect(report.slides[1].speech.totalFillerCount).toBe(0)
    expect(report.slides[0].speech.fillerBreakdown).toEqual([
      { word: '음', count: 1 },
      { word: '아', count: 1 },
      { word: '어', count: 1 },
    ])
    expect(report.slides[1].speech.fillerBreakdown).toEqual([])
    expect(report.slides[0].speech.buckets[1].fillerEvents).toEqual([
      { word: '어', atSec: 15, absoluteAtSec: 15 },
    ])
    expect(report.slides[1].speech.buckets[0].fillerEvents).toEqual([])
    expect(report.slides[0].speech.silenceDetectedWindowCount).toBe(1)
    expect(report.slides[1].speech.silenceDetectedWindowCount).toBe(0)
    expect(report.slides[0].transcriptSegments[0]).toMatchObject({
      text: '첫 슬라이드',
      startSec: 0.8,
      endSec: 4.2,
    })
    expect(report.audioStt.segments[1]).toMatchObject({
      absoluteStartSec: 13.2,
      absoluteEndSec: 18.7,
      isTimestamped: true,
    })
    expect(report.slides[1].transcriptSegments[0].isTimestamped).toBe(true)
    expect(report.slides[1].transcriptSegments[0].startSec).toBeCloseTo(1.2)
    expect(report.slides[1].transcriptSegments[0].endSec).toBeCloseTo(6.7)
    expect(report.slides[0].gesture).toBeNull()
    expect(report.speechAnalysis.fillerBreakdown).toEqual([
      { word: '음', count: 1 },
      { word: '아', count: 1 },
      { word: '어', count: 1 },
    ])
  })

  it('maps nested nonverbal gesture buckets and gaze events to local slide time', () => {
    const report = normalizePresentationReport({
      ...response,
      nonverbalAnalysis: {
        gestureSeries: {
          buckets: [
            { startSec: 0, endSec: 10, tiltPct: 12.5 },
            { startSec: 10, endSec: 20, tiltPct: 18 },
          ],
          gazeCount: 2,
          gazeEvents: [{ atSec: 4 }, { atSec: 15 }],
        },
      },
    })

    expect(report.slides[0].gesture.buckets).toEqual([
      { startSec: 0, endSec: 10, tiltPercent: 12.5 },
      { startSec: 10, endSec: 12, tiltPercent: 18 },
    ])
    expect(report.slides[0].gesture.gazeEvents).toEqual([{ atSec: 4 }])
    expect(report.slides[1].gesture.gazeEvents).toEqual([{ atSec: 3 }])
    expect(report.gestureSeries.gazeCount).toBe(2)
  })

  it('uses the average of answered question feedback scores before the aggregate score', () => {
    const report = normalizePresentationReport({
      ...response,
      score: {
        ...response.score,
        questionAnswerScore: 42,
      },
      questionAnswers: [
        { questionId: 201, feedback: { score: 80, content: '첫 피드백' } },
        { questionId: 202, feedback: null },
        { questionId: 203, feedback: { score: 91, content: '셋째 피드백' } },
      ],
    })

    expect(report.score.questionAnswerScore).toBe(85.5)
  })
})
