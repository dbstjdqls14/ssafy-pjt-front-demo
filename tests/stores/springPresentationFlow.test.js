import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { presentationApi } from '../../src/api/presentationApi.js'
import { practiceApi } from '../../src/api/practiceApi.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'

const recordingBlob = (type) => new Blob([new Uint8Array(1_024)], { type })

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('Spring presentation store flow', () => {
  test('uploads once, polls until completed, and loads server slides', async () => {
    const practice = usePracticeStore()
    practice.setFolder({ id: '77', name: '발표 폴더' })
    const store = usePresentationStore()
    store.setTitle('API 발표')
    store.setDescription('연결 검증')
    store.setTargetMinutes(5)
    store.setQnaEnabled(true)
    const file = new File(['pdf'], 'demo.pdf', { type: 'application/pdf' })

    const create = vi.spyOn(presentationApi, 'create').mockResolvedValue({
      presentationId: 9,
      practiceId: 19,
      status: 'PENDING',
    })
    vi.spyOn(presentationApi, 'getStatus')
      .mockResolvedValueOnce({ presentationId: 9, processingStatus: 'PROCESSING' })
      .mockResolvedValueOnce({ presentationId: 9, processingStatus: 'COMPLETED' })
    vi.spyOn(presentationApi, 'getSlides').mockResolvedValue({
      slides: [
        { slideId: 101, slideNumber: 1, imageUrl: '/slide-1.png', description: '핵심 1' },
        { slideId: 102, slideNumber: 2, imageUrl: '/slide-2.png', description: '핵심 2' },
      ],
    })

    await store.uploadPresentation(file, { pollIntervalMs: 0, maxAttempts: 3 })

    expect(create).toHaveBeenCalledWith({
      request: {
        folderId: 77,
        title: 'API 발표',
        description: '연결 검증',
        targetDurationSec: 300,
        aiQnaEnabled: true,
      },
      file,
    })
    expect(store.sessionId).toBe(9)
    expect(store.practiceId).toBe(19)
    expect(store.uploadStatus).toBe('ready')
    expect(store.slides).toEqual([
      expect.objectContaining({ id: 101, number: 1, previewUrl: '/slide-1.png', keyPoints: '핵심 1' }),
      expect.objectContaining({ id: 102, number: 2, previewUrl: '/slide-2.png', keyPoints: '핵심 2' }),
    ])
  })

  test('loads report processing state from the canonical presentation status endpoint', async () => {
    const store = usePresentationStore()
    const getStatus = vi.spyOn(presentationApi, 'getStatus').mockResolvedValue({
      data: { processingStatus: 'PENDING' },
    })

    await expect(store.loadProcessingStatus(7)).resolves.toEqual({
      processingStatus: 'PENDING',
    })
    expect(getStatus).toHaveBeenCalledWith(7)
  })

  test('saves every slide description using the bulk Spring DTO', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.setSlides([
      { slideId: 101, slideNumber: 1, imageUrl: '/1.png', description: '첫 설명' },
      { slideId: 102, slideNumber: 2, imageUrl: '/2.png', description: '둘 설명' },
    ])
    const update = vi.spyOn(presentationApi, 'updateDescriptions').mockResolvedValue('')

    await store.saveSlideNotes()

    expect(update).toHaveBeenCalledWith(9, [
      { slideId: 101, description: '첫 설명' },
      { slideId: 102, description: '둘 설명' },
    ])
  })

  test('starts once, sends slide ids, and completes with the captured multipart payload', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.setSlides([
      { slideId: 101, slideNumber: 1, imageUrl: '/1.png', description: '첫 설명' },
      { slideId: 102, slideNumber: 2, imageUrl: '/2.png', description: '둘 설명' },
    ])
    vi.spyOn(presentationApi, 'start').mockResolvedValue({
      practiceId: 19,
      firstSlideId: 101,
      firstSlideNumber: 1,
    })
    const slideEvent = vi.spyOn(presentationApi, 'createSlideEvent').mockResolvedValue('')
    const complete = vi.spyOn(presentationApi, 'complete').mockResolvedValue('')
    const wavBlob = recordingBlob('audio/wav')
    const webmBlob = recordingBlob('video/webm')
    const nonverbal = {
      gazeDeviationCount: 1,
      postureTiltPercent: 25,
      sampleCount: 4,
      gazeEvents: [{ atSec: 3.2 }],
      tiltBuckets: [{ startSec: 0, endSec: 10, tiltPct: 25 }],
    }

    await store.startRecordingSession()
    await store.recordSlideTransition(0, 1, 18.342)
    store.setRecordingArtifacts({
      webmBlob,
      wavBlob,
      text: [
        { page: 1, timestamp: 0, content: '발표 내용' },
        { page: 2, timestamp: 18_342, content: '   ' },
      ],
      nonverbal,
      durationMs: 20_000,
    })
    await store.completeSession({ durationMs: 20_000 })

    expect(store.practiceId).toBe(19)
    expect(slideEvent).toHaveBeenCalledWith(9, {
      toSlideId: 102,
      occurredTimeMs: 18_342,
    })
    expect(complete).toHaveBeenCalledWith(9, {
      request: {
        durationMs: 20_000,
        text: [{ page: 1, timestamp: 0, content: '발표 내용' }],
        nonverbal,
      },
      audio: wavBlob,
      video: webmBlob,
    })
  })

  test('serializes slide events and waits for the queue before complete', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.setSlides([
      { slideId: 101, slideNumber: 1, imageUrl: '/1.png', description: '첫 설명' },
      { slideId: 102, slideNumber: 2, imageUrl: '/2.png', description: '둘 설명' },
      { slideId: 103, slideNumber: 3, imageUrl: '/3.png', description: '셋 설명' },
    ])
    vi.spyOn(presentationApi, 'start').mockResolvedValue({
      practiceId: 19,
      firstSlideId: 101,
      firstSlideNumber: 1,
    })

    let resolveFirstEvent
    const firstEventPending = new Promise((resolve) => { resolveFirstEvent = resolve })
    const slideEvent = vi.spyOn(presentationApi, 'createSlideEvent')
      .mockImplementationOnce(() => firstEventPending)
      .mockResolvedValueOnce('')
    const complete = vi.spyOn(presentationApi, 'complete').mockResolvedValue('')

    await store.startRecordingSession()
    const firstTransition = store.recordSlideTransition(0, 1, 10)
    const secondTransition = store.recordSlideTransition(1, 2, 20)
    store.setRecordingArtifacts({
      webmBlob: recordingBlob('video/webm'),
      wavBlob: recordingBlob('audio/wav'),
      text: [{ page: 1, timestamp: 0, content: '발표 내용' }],
      nonverbal: {
        gazeDeviationCount: 0,
        postureTiltPercent: 0,
        sampleCount: 0,
        gazeEvents: [],
        tiltBuckets: [],
      },
      durationMs: 30_000,
    })
    const completing = store.completeSession({ durationMs: 30_000 })

    await Promise.resolve()
    expect(slideEvent).toHaveBeenCalledTimes(1)
    expect(complete).not.toHaveBeenCalled()

    resolveFirstEvent('')
    await Promise.all([firstTransition, secondTransition, completing])

    expect(slideEvent).toHaveBeenNthCalledWith(1, 9, {
      toSlideId: 102,
      occurredTimeMs: 10_000,
    })
    expect(slideEvent).toHaveBeenNthCalledWith(2, 9, {
      toSlideId: 103,
      occurredTimeMs: 20_000,
    })
    expect(complete).toHaveBeenCalledTimes(1)
  })

  test('coalesces concurrent complete calls and ignores calls after completion', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.setRecordingArtifacts({
      webmBlob: recordingBlob('video/webm'),
      wavBlob: recordingBlob('audio/wav'),
      text: [{ page: 1, timestamp: 0, content: '발표 내용' }],
      nonverbal: {
        gazeDeviationCount: 0,
        postureTiltPercent: 0,
        sampleCount: 0,
        gazeEvents: [],
        tiltBuckets: [],
      },
      durationMs: 10_000,
    })
    let resolveComplete
    const pendingComplete = new Promise((resolve) => { resolveComplete = resolve })
    const complete = vi.spyOn(presentationApi, 'complete').mockReturnValue(pendingComplete)

    const first = store.completeSession({ durationMs: 10_000 })
    const second = store.completeSession({ durationMs: 10_000 })
    await vi.waitFor(() => expect(complete).toHaveBeenCalled())

    expect(complete).toHaveBeenCalledOnce()
    resolveComplete('')
    await Promise.all([first, second])
    await store.completeSession({ durationMs: 10_000 })

    expect(complete).toHaveBeenCalledOnce()
  })

  test('blocks incomplete presentation media before calling complete', async () => {
    const store = usePresentationStore()
    store.sessionId = 9
    store.setRecordingArtifacts({
      webmBlob: recordingBlob('video/webm'),
      wavBlob: new Blob([], { type: 'audio/wav' }),
      text: [],
      nonverbal: null,
      durationMs: 10_000,
    })
    const complete = vi.spyOn(presentationApi, 'complete').mockResolvedValue('')

    await expect(store.completeSession()).rejects.toMatchObject({ code: 'AUDIO_TOO_SMALL' })
    expect(complete).not.toHaveBeenCalled()
  })

  test('sends presentation chunks with practiceId and stores the response', async () => {
    const store = usePresentationStore()
    store.practiceId = 19
    const wavBlob = new Blob(['wav'], { type: 'audio/wav' })
    const analyze = vi.spyOn(practiceApi, 'analyzeAudio').mockResolvedValue({
      practiceId: 19,
      sequence: 0,
      fillerCount: 1,
      feedback: '속도가 안정적입니다.',
    })

    const response = await store.analyzeAudioChunk({
      blob: wavBlob,
      sequence: 0,
    })

    expect(analyze).toHaveBeenCalledWith(19, {
      blob: wavBlob,
      sequence: 0,
      fileName: 'presentation-0000.wav',
    })
    expect(response.sequence).toBe(0)
    expect(store.audioAnalysisResults).toHaveLength(1)
    expect(store.audioAnalysisState).toMatchObject({
      status: 'success',
      sequence: 0,
      error: null,
    })
  })

  test('exposes a failed 10-second request immediately without losing its sequence', async () => {
    const store = usePresentationStore()
    store.practiceId = 19
    const failure = Object.assign(new Error('Audio analysis failed.'), {
      status: 502,
      code: '50201',
    })
    vi.spyOn(practiceApi, 'analyzeAudio').mockRejectedValue(failure)

    await expect(store.analyzeAudioChunk({
      blob: new Blob(['wav'], { type: 'audio/wav' }),
      sequence: 3,
    })).rejects.toBe(failure)

    expect(store.audioAnalysisState).toEqual({
      status: 'error',
      sequence: 3,
      error: {
        message: 'Audio analysis failed.',
        status: 502,
        code: '50201',
      },
    })
  })
})
