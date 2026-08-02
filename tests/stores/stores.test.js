import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { archiveApi, documentApi, get, interviewApi, practiceApi } from '../../src/api/index.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import { useInterviewStore } from '../../src/stores/interviewStore.js'
import { useArchiveStore } from '../../src/stores/archiveStore.js'
import { useDocumentsStore } from '../../src/stores/documentsStore.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'
import { useRecordingStore } from '../../src/stores/recordingStore.js'

beforeEach(() => {
  vi.restoreAllMocks()
  setActivePinia(createPinia())
  localStorage.clear()
  sessionStorage.clear()
})

describe('api client', () => {
  test('rejects an SPA HTML fallback so withMock can take over', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
      text: async () => '<!doctype html><html></html>',
    })

    await expect(get('/missing-endpoint')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'API endpoint returned the SPA document',
    })
  })
})

describe('recordingStore camera framing', () => {
  test('keeps the selected zoom when live recording state resets', () => {
    const store = useRecordingStore()

    store.setCameraZoom(1.6)
    store.reset()

    expect(store.cameraZoom).toBe(1.6)
    store.setCameraZoom(4)
    expect(store.cameraZoom).toBe(2)
  })
})

describe('practiceStore', () => {
  test('shows a folder-specific message when the list endpoint rejects GET', async () => {
    const failure = Object.assign(new Error('아직 준비되지 않은 기능이에요.'), { status: 405 })
    vi.spyOn(practiceApi, 'listFolders').mockRejectedValue(failure)
    const store = usePracticeStore()

    await expect(store.loadFolders({ type: 'presentation' })).rejects.toBe(failure)

    expect(store.error).toBe('기존 폴더 조회 API가 아직 연결되지 않았어요.')
  })

  test('loads folders from the API and keeps the selected server folder id', async () => {
    vi.spyOn(practiceApi, 'listFolders').mockResolvedValue({
      data: {
        folders: [
          { folderId: 41, folderName: '프론트 발표', practiceType: 'PRESENTATION', practiceCount: 3 },
        ],
      },
    })
    const store = usePracticeStore()

    await store.loadFolders({ type: 'presentation' })
    store.setFolder(store.folders[0])

    expect(store.folders[0]).toMatchObject({
      id: '41',
      name: '프론트 발표',
      type: 'presentation',
      count: 3,
    })
    expect(store.folderId).toBe('41')
  })

})

describe('presentationStore', () => {
  test('restores a completed Spring conversion from session storage', () => {
    sessionStorage.setItem('aivo.presentation-flow', JSON.stringify({
      sessionId: 31,
      practiceId: 91,
      sourceFile: { name: 'large-deck.pptx', size: 28964605 },
      uploadStatus: 'ready',
      slides: [{ id: 1, number: 1, title: '서버 슬라이드', previewUrl: '/api/v1/presentations/31/slides/1/image' }],
    }))

    const store = usePresentationStore()

    expect(store.sessionId).toBe(31)
    expect(store.practiceId).toBe(91)
    expect(store.sourceFile.name).toBe('large-deck.pptx')
    expect(store.uploadStatus).toBe('ready')
    expect(store.slides).toHaveLength(1)
    expect(store.hasRenderableSlides).toBe(true)
  })

  test('clamps target minutes to 1..60', () => {
    const store = usePresentationStore()
    store.setTargetMinutes(999)
    expect(store.targetMinutes).toBe(60)
    store.setTargetMinutes(0)
    expect(store.targetMinutes).toBe(1)
  })

  test('formats recorded duration as m:ss', () => {
    const store = usePresentationStore()
    store.setRecordedSeconds(125)
    expect(store.recordedDuration).toBe('2:05')
  })

  test('setSlides normalizes ids and resets index; keyPoints update by id', () => {
    const store = usePresentationStore()
    store.setSlides([{ title: 'A' }, { title: 'B' }])
    expect(store.slideCount).toBe(2)
    expect(store.slides[0].id).toBe(1)
    store.setSlideKeyPoints(1, '핵심')
    expect(store.slides[0].keyPoints).toBe('핵심')
  })

  test('builds a report only from captured presentation data', async () => {
    const store = usePresentationStore()
    store.setTitle('API 발표')
    store.setSlides([
      { slideId: 1, slideNumber: 1, title: '첫 장', imageUrl: '/slides/1.png' },
    ])
    store.setRecordingArtifacts({
      durationMs: 10_000,
      text: [{ page: 1, timestamp: 0, content: '발표 내용' }],
      detects: [{
        timestamp: 0,
        sequence: 0,
        bodyStability: { average: 88, outlierList: [] },
        sideGlance: [3_000],
      }],
    })
    await store.loadReport()

    expect(store.report).toMatchObject({
      title: 'API 발표',
      slides: [{ id: 1, previewUrl: '/slides/1.png' }],
      text: [{ content: '발표 내용' }],
      detects: [{ sequence: 0 }],
    })
  })
})

describe('interviewStore', () => {
  test('estimatedMinutes sums question minutes', () => {
    const store = useInterviewStore()
    store.setQuestions([
      { text: 'q1', cat: '공통', min: 2 },
      { text: 'q2', cat: '기술', min: 3 },
    ])
    expect(store.questionCount).toBe(2)
    expect(store.estimatedMinutes).toBe(5)
  })

  test('uses the created interview and questions returned by the real API contract', async () => {
    const create = vi.spyOn(interviewApi, 'create').mockResolvedValue({
      interviewId: 21,
      practiceId: 31,
      interviewerId: 2,
      questionItems: [{ questionId: 41, question: '서버 질문' }],
    })
    const practice = usePracticeStore()
    practice.setFolder({ id: '77', name: '취업 준비' })
    const store = useInterviewStore()
    store.setInfo({ title: '서버 연동 면접', companyId: '1' })
    store.setInterviewer({ id: '2', code: 'PRACTICAL' })

    await store.createInterview()

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ folderId: 77, companyId: 1, interviewerId: 2 }))
    expect(store.interviewId).toBe(21)
    expect(store.questions[0].text).toBe('서버 질문')
  })

  test('uploads the recording blobs and answer segments when completing an interview', async () => {
    const complete = vi.spyOn(interviewApi, 'complete').mockResolvedValue({ overallScore: 91 })
    const store = useInterviewStore()
    store.interviewId = 21
    const blob = new Blob(['recorded'], { type: 'video/webm' })
    const answers = [{ questionId: 41, question: '서버 질문', answer: '답변', startTime: 1, endTime: 12 }]

    store.finishRecording({ blob, durationSeconds: 12, answers })
    await store.completeInterview()

    expect(complete).toHaveBeenCalledWith(21, {
      request: {
        durationSec: 12,
        answers: [{ questionId: 41, question: '서버 질문', answer: '답변', startTime: 1, endTime: 12 }],
        nonverbal: null,
      },
      blob,
      videoBlob: blob,
    })
    expect(store.report.overallScore).toBe(91)
  })

  test('fetches the report by id when revisiting from another session', async () => {
    const getReport = vi.spyOn(interviewApi, 'getReport').mockResolvedValue({
      overallScore: 72,
      questions: [],
    })
    const store = useInterviewStore()

    await store.loadReport('47')

    expect(getReport).toHaveBeenCalledWith('47')
    expect(store.report.overallScore).toBe(72)
  })

  test('propagates a missing report endpoint without creating a demo report', async () => {
    const failure = Object.assign(new Error('not found'), { status: 404 })
    vi.spyOn(interviewApi, 'getReport').mockRejectedValue(failure)
    const store = useInterviewStore()

    await expect(store.loadReport('missing-id')).rejects.toBe(failure)

    expect(store.report).toBeNull()
  })
})

describe('archiveStore', () => {
  test('add prepends a session and it becomes findable', () => {
    const store = useArchiveStore()
    store.add({ id: 'x1', type: 'presentation', title: '새 발표', date: '2026.07.25', time: '10:00', score: 91, duration: '3분' })
    expect(store.find('x1').score).toBe(91)
  })

  test('loads search and type results from the folder archive API', async () => {
    const list = vi.spyOn(archiveApi, 'listFolders').mockResolvedValue({
      totalElements: 1,
      currentPage: 0,
      totalPage: 1,
      hasNext: false,
      folders: [{ folderId: 7, type: 'INTERVIEW', name: '카카오 면접', maxScore: 93 }],
    })
    const store = useArchiveStore()
    await store.loadFolders({ type: 'interview', keyword: '카카오', page: 0 })

    expect(list).toHaveBeenCalledWith({ type: 'interview', keyword: '카카오', page: 0 })
    expect(store.folderPage.folders).toHaveLength(1)
    expect(store.folderPage.folders[0]).toMatchObject({ folderId: '7', type: 'interview', name: '카카오 면접', maxScore: 93 })
  })

  test('loads recording URL and report details for playback', async () => {
    vi.spyOn(archiveApi, 'getRecord').mockResolvedValue({
      data: {
        reportId: 9,
        folderName: '서비스 발표',
        videoUrl: 'https://cdn.example.com/presentation-9.webm',
        durationSeconds: 180,
      },
    })
    const store = useArchiveStore()

    const report = await store.loadRecord('9')

    expect(report).toMatchObject({
      id: '9',
      title: '서비스 발표',
      recordingUrl: 'https://cdn.example.com/presentation-9.webm',
      durationSeconds: 180,
    })
  })
})

describe('documentsStore', () => {
  test('loads document metadata and deletes through the API', async () => {
    vi.spyOn(documentApi, 'listDocuments').mockResolvedValue({
      data: { documents: [{ documentId: 10, fileName: '이력서.pdf', documentType: 'RESUME', fileSize: 1024, createdAt: '2026-07-20' }] },
    })
    const remove = vi.spyOn(documentApi, 'deleteDocument').mockResolvedValue('')
    const store = useDocumentsStore()

    await store.loadDocuments()
    expect(store.documents[0]).toMatchObject({ id: '10', name: '이력서.pdf', type: 'resume' })
    await store.removeDocument('10')

    expect(remove).toHaveBeenCalledWith('10')
    expect(store.documents).toHaveLength(0)
  })
})
