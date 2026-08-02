import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { interviewApi } from '../../src/api/interviewApi.js'
import { presentationApi } from '../../src/api/presentationApi.js'
import { practiceApi } from '../../src/api/practiceApi.js'

const jsonResponse = (payload = {}) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

const latestRequest = () => {
  const [url, options] = globalThis.fetch.mock.calls.at(-1)
  return { url, options }
}

describe('Spring presentation API contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse())))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a presentation with the request JSON part and source file', async () => {
    const file = new File(['slides'], 'demo.pdf', { type: 'application/pdf' })
    const request = {
      folderId: 4,
      title: '데모 발표',
      description: 'API 연결 확인',
      targetDurationSec: 300,
      aiQnaEnabled: true,
    }

    await presentationApi.create({ request, file })

    const { url, options } = latestRequest()
    expect(url).toBe('/api/v1/presentations')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBe(file)
    expect(options.body.get('request')).toBeInstanceOf(Blob)
    await expect(options.body.get('request').text()).resolves.toBe(JSON.stringify(request))
  })

  it('uses the Spring status, slides, descriptions, and reupload routes', async () => {
    const file = new File(['slides'], 'replacement.pdf', { type: 'application/pdf' })

    await presentationApi.getStatus(7)
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/presentations/7/status',
      options: { method: 'GET' },
    })

    await presentationApi.getSlides(7)
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/presentations/7/slides',
      options: { method: 'GET' },
    })

    await presentationApi.updateDescriptions(7, [
      { slideId: 11, description: '첫 번째 핵심 내용' },
    ])
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/presentations/7/slides/descriptions',
      options: {
        method: 'PATCH',
        body: JSON.stringify({
          slides: [{ slideId: 11, description: '첫 번째 핵심 내용' }],
        }),
      },
    })

    await presentationApi.reupload(7, file)
    const reupload = latestRequest()
    expect(reupload.url).toBe('/api/v1/presentations/7/presentation-document')
    expect(reupload.options.method).toBe('PUT')
    expect(reupload.options.body.get('file')).toBe(file)
  })

  it('starts, records slide events, and completes a presentation practice', async () => {
    await presentationApi.start(7)
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/presentations/7/start',
      options: { method: 'POST' },
    })

    await presentationApi.createSlideEvent(7, {
      toSlideId: 12,
      occurredTimeMs: 18_342,
    })
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/presentations/7/slide-events',
      options: {
        method: 'POST',
        body: JSON.stringify({ toSlideId: 12, occurredTimeMs: 18_342 }),
      },
    })

    await presentationApi.complete(7, 22_000)
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/presentations/7/complete',
      options: {
        method: 'POST',
        body: JSON.stringify({ durationMs: 22_000 }),
      },
    })
  })

  it('generates and reads audience questions with slide visit transcripts', async () => {
    const visits = [
      { page: 1, content: '첫 번째 설명' },
      { page: 2, content: '두 번째 설명' },
      { page: 1, content: '첫 번째 추가 설명' },
    ]

    await presentationApi.generateQuestions(7, visits)
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/presentations/7/presentation-questions/generate',
      options: { method: 'POST', body: JSON.stringify(visits) },
    })

    await presentationApi.getQuestions(7)
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/presentations/7/presentation-questions',
      options: { method: 'GET' },
    })
  })
})

describe('shared practice audio-analysis contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({
      practiceId: 31,
      sequence: 0,
    }))))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends audio with a zero-based sequence using practiceId', async () => {
    const wav = new Blob(['wav'], { type: 'audio/wav' })

    await practiceApi.analyzeAudio(31, {
      blob: wav,
      sequence: 0,
      fileName: 'chunk-0000.wav',
    })

    const { url, options } = latestRequest()
    expect(url).toBe('/api/v1/practices/31/audio-analysis?sequence=0')
    expect(options.method).toBe('POST')
    expect(options.body.has('sequence')).toBe(false)
    expect(options.body.get('audio')).toBeInstanceOf(File)
    expect(options.body.get('audio').name).toBe('chunk-0000.wav')
    expect(options.body.get('audio').type).toBe('audio/wav')
  })

  it('keeps interview report lookup while routing interview WAV through practiceId', async () => {
    const wav = new Blob(['wav'], { type: 'audio/wav' })

    await interviewApi.getReport(19)
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/interviews/19/interview-report',
      options: { method: 'GET' },
    })

    await interviewApi.analyzeAudio(31, {
      blob: wav,
      sequence: 2,
      fileName: 'answer-0002.wav',
    })

    const { url, options } = latestRequest()
    expect(url).toBe('/api/v1/practices/31/audio-analysis?sequence=2')
    expect(options.body.has('sequence')).toBe(false)
    expect(options.body.get('audio').name).toBe('answer-0002.wav')
  })
})
