import { describe, expect, it } from 'vitest'

import { normalizePracticeTrends } from '../../src/api/normalizers/trends.js'

const response = {
  earlyTrend: {
    content: 82,
    stability: 71,
    glance: 2,
    filler: 1.4,
    speed: 11.2,
    totalTime: 5.2,
  },
  lateTrend: {
    content: 91,
    stability: 68,
    glance: 1.3,
    filler: 0.8,
    speed: 14.8,
    totalTime: 3.4,
  },
  practices: [
    { contentScore: 74, videoScore: 66, voiceScore: 74 },
    { contentScore: 76, videoScore: 68, voiceScore: 76 },
    { contentScore: 78, videoScore: 69, voiceScore: 78 },
    { contentScore: 90, videoScore: 80, voiceScore: 80 },
    { contentScore: 80, videoScore: 70, voiceScore: 90 },
    { contentScore: 81, videoScore: 71, voiceScore: 91 },
  ],
  speech: {
    averageSpeechSpeed: 137,
    earlySpeechSpeed: 122,
    lateSpeechSpeed: 152,
    silenceLate: 4.2,
  },
}

describe('practice trends normalizer', () => {
  it('maps six summary metrics with the correct improvement directions', () => {
    const result = normalizePracticeTrends(response)

    expect(result.metrics).toHaveLength(6)
    expect(result.metrics.find(({ key }) => key === 'content')).toMatchObject({
      value: 91,
      deltaLabel: '이전 3회보다 9점 상승',
      tone: 'positive',
    })
    expect(result.metrics.find(({ key }) => key === 'stability')).toMatchObject({
      value: 68,
      tone: 'negative',
    })
    expect(result.metrics.find(({ key }) => key === 'glance')).toMatchObject({
      value: 1.3,
      deltaLabel: '이전 3회보다 0.7회/분 감소',
      tone: 'positive',
    })
    expect(result.metrics.find(({ key }) => key === 'filler')).toMatchObject({
      label: '추임새 밀도',
      value: 0.8,
    })
    expect(result.metrics.find(({ key }) => key === 'speed')).toMatchObject({
      value: 14.8,
      deltaLabel: '이전 3회보다 3.6%p 증가',
      tone: 'negative',
    })
  })

  it('formats raw metric decimals for display without changing chart math values', () => {
    const result = normalizePracticeTrends({
      ...response,
      lateTrend: {
        ...response.lateTrend,
        content: 91.49,
        glance: 33.33333206176758,
      },
    })

    expect(result.metrics.find(({ key }) => key === 'content')).toMatchObject({
      value: 91.49,
      displayValue: '91',
    })
    expect(result.metrics.find(({ key }) => key === 'glance')).toMatchObject({
      value: 33.33333206176758,
      displayValue: '33.3',
    })
  })

  it('marks invalid and out-of-range score values as unavailable', () => {
    const result = normalizePracticeTrends({
      ...response,
      lateTrend: {
        ...response.lateTrend,
        content: 108,
        stability: 'Infinity',
      },
    })

    expect(result.metrics.find(({ key }) => key === 'content')).toMatchObject({
      value: null,
      displayValue: '-',
      tone: 'neutral',
    })
    expect(result.metrics.find(({ key }) => key === 'stability')).toMatchObject({
      value: null,
      displayValue: '-',
      tone: 'neutral',
    })
  })

  it('creates only content, body, and voice score series in response order', () => {
    const result = normalizePracticeTrends(response)

    expect(result.scoreSeries.map(({ key }) => key)).toEqual(['content', 'video', 'voice'])
    expect(result.scoreSeries.map(({ label }) => label)).toEqual(['내용', '몸짓', '음성'])
    expect(result.scoreSeries.find(({ key }) => key === 'voice').values).toEqual([74, 76, 78, 80, 90, 91])
  })

  it('keeps valid score decimals for chart math and rejects impossible score points', () => {
    const result = normalizePracticeTrends({
      ...response,
      practices: [
        { contentScore: 91.49999999 },
        { contentScore: 108 },
        { contentScore: Number.POSITIVE_INFINITY },
      ],
    })

    expect(result.scoreSeries.find(({ key }) => key === 'content').values).toEqual([
      91.49999999,
      null,
      null,
    ])
  })

  it('formats speech values and computes the late speed change', () => {
    const result = normalizePracticeTrends({ data: response })

    expect(result.speechReference).toEqual({
      averageWpm: '137 WPM',
      earlyWpm: '122 WPM',
      lateWpm: '152 WPM',
      lateChange: '+24.6%',
      silenceRatio: '4.2%',
    })
  })

  it('preserves missing values and marks insufficient history without inventing zeroes', () => {
    const result = normalizePracticeTrends({
      earlyTrend: null,
      lateTrend: { content: null },
      practices: [{ contentScore: 88, videoScore: null, voiceScore: 84 }],
      speech: {},
    })

    expect(result.hasPreviousData).toBe(false)
    expect(result.metrics.find(({ key }) => key === 'content').value).toBeNull()
    expect(result.scoreSeries.find(({ key }) => key === 'video').values).toEqual([null])
    expect(result.speechReference).toEqual({
      averageWpm: '-',
      earlyWpm: '-',
      lateWpm: '-',
      lateChange: '-',
      silenceRatio: '-',
    })
  })

  it('matches the backend half-window grouping for two, four, and six records', () => {
    const twoRecords = normalizePracticeTrends({
      ...response,
      practices: [
        { contentScore: 70 },
        { contentScore: 90 },
      ],
    })
    const fourRecords = normalizePracticeTrends({
      ...response,
      practices: [
        { contentScore: 70 },
        { contentScore: 80 },
        { contentScore: 85 },
        { contentScore: 90 },
      ],
    })
    const sixRecords = normalizePracticeTrends({
      ...response,
      practices: [
        { contentScore: 68 },
        { contentScore: 72 },
        { contentScore: 76 },
        { contentScore: 80 },
        { contentScore: 85 },
        { contentScore: 90 },
      ],
    })

    expect(twoRecords).toMatchObject({
      hasPreviousData: true,
      previousCount: 1,
      recentCount: 1,
      previousLabel: '이전 1회',
      recentLabel: '최근 1회',
    })
    expect(fourRecords).toMatchObject({
      hasPreviousData: true,
      previousCount: 2,
      recentCount: 2,
      previousLabel: '이전 2회',
      recentLabel: '최근 2회',
    })
    expect(sixRecords).toMatchObject({
      hasPreviousData: true,
      previousCount: 3,
      recentCount: 3,
      previousLabel: '이전 3회',
      recentLabel: '최근 3회',
    })
  })
})
