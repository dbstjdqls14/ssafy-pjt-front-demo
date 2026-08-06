import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import {
  archiveApi,
  authApi,
  get,
  interviewApi,
  portfolioApi,
  practiceApi,
  presentationApi,
  resumeApi,
  userApi,
} from '../../src/api/index.js'
import { clearAccessToken } from '../../src/api/authToken.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import { useInterviewStore } from '../../src/stores/interviewStore.js'
import { useArchiveStore } from '../../src/stores/archiveStore.js'
import { useDocumentsStore } from '../../src/stores/documentsStore.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'
import { useRecordingStore } from '../../src/stores/recordingStore.js'
import { useAuthStore } from '../../src/stores/authStore.js'
import { ApiError } from '../../src/api/client.js'

const recordingBlob = (type) => new Blob([new Uint8Array(1_024)], { type })

beforeEach(() => {
  vi.restoreAllMocks()
  setActivePinia(createPinia())
  localStorage.clear()
  sessionStorage.clear()
  clearAccessToken()
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

describe('authStore profile update', () => {
  test('refreshes the current user from the server after login', async () => {
    const token = `header.${btoa(JSON.stringify({ userId: 7 }))}.signature`
    vi.spyOn(authApi, 'login').mockResolvedValue({ tokenResponse: { accessToken: token } })
    vi.spyOn(authApi, 'me').mockResolvedValue({
      userId: 7,
      email: 'user@example.com',
      nickname: '서버 닉네임',
      profileImageUrl: 'https://cdn.example.com/profile.png',
    })
    const store = useAuthStore()

    await store.login({ email: 'user@example.com', password: 'password' })

    expect(authApi.me).toHaveBeenCalledTimes(1)
    expect(store.user).toMatchObject({
      userId: 7,
      nickname: '서버 닉네임',
      profileImageUrl: 'https://cdn.example.com/profile.png',
    })
  })

  test('updates global profile state even when the follow-up refresh fails', async () => {
    vi.spyOn(userApi, 'updateProfile').mockResolvedValue({
      userId: 1,
      nickname: '새 닉네임',
      profileImageUrl: 'https://cdn.example.com/new.png',
    })
    vi.spyOn(authApi, 'me').mockRejectedValue(new ApiError('network', { status: 500 }))
    const store = useAuthStore()
    store.setUser({
      userId: 1,
      nickname: '기존',
      email: 'user@example.com',
      profileImageUrl: 'https://cdn.example.com/old.png',
    })

    await expect(store.updateProfile({ nickname: '새 닉네임' })).resolves.toMatchObject({
      nickname: '새 닉네임',
    })
    await Promise.resolve()

    expect(store.user).toMatchObject({
      userId: 1,
      email: 'user@example.com',
      nickname: '새 닉네임',
      profileImageUrl: 'https://cdn.example.com/new.png',
    })
  })

  test('does not turn an unavailable profile endpoint into a mock success', async () => {
    const failure = new ApiError('not found', { status: 404 })
    vi.spyOn(userApi, 'updateProfile').mockRejectedValue(failure)
    const store = useAuthStore()
    store.setUser({ userId: 1, nickname: '기존', email: 'user@example.com' })

    await expect(store.updateProfile({
      nickname: '변경',
      profileImage: null,
      removeProfileImage: false,
    })).rejects.toBe(failure)

    expect(store.user.nickname).toBe('기존')
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
  test('does not let an older folder list response remove a newly created folder', async () => {
    let resolveList
    vi.spyOn(practiceApi, 'listFolders').mockImplementation(() => new Promise((resolve) => {
      resolveList = resolve
    }))
    vi.spyOn(practiceApi, 'createFolder').mockResolvedValue({
      folderId: 91,
      name: '새 발표 폴더',
      type: 'presentation',
      practiceCount: 0,
    })
    const store = usePracticeStore()

    const loading = store.loadFolders({ type: 'presentation' })
    await store.createFolder({ name: '새 발표 폴더', type: 'presentation' })
    resolveList([{ folderId: 10, name: '기존 폴더', type: 'presentation' }])
    await loading

    expect(store.folders.map((folder) => folder.id)).toEqual(['91'])
    expect(store.folderId).toBe('91')
  })

  test('remembers a created folder type when Spring later omits or echoes another type', async () => {
    vi.spyOn(practiceApi, 'createFolder').mockResolvedValue({
      folderId: 92,
      name: '면접 폴더',
      type: 'interview',
    })
    vi.spyOn(practiceApi, 'listFolders').mockResolvedValue([
      { folderId: 92, name: '면접 폴더', type: 'presentation' },
    ])
    const store = usePracticeStore()

    await store.createFolder({ name: '면접 폴더', type: 'interview' })
    await store.loadFolders({ type: 'interview' })

    expect(store.folders).toEqual([
      expect.objectContaining({ id: '92', type: 'interview' }),
    ])
  })

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

  test('merges completed archive score statistics into selectable folders', async () => {
    vi.spyOn(practiceApi, 'listFolders').mockResolvedValue({
      folders: [{
        folderId: 41,
        name: '서비스 발표',
        description: '발표 폴더',
        type: 'presentation',
        attemptCount: 9,
      }],
    })
    vi.spyOn(archiveApi, 'listFolders').mockResolvedValue({
      totalElements: 1,
      currentPage: 0,
      totalPage: 1,
      hasNext: false,
      folders: [{
        folderId: 41,
        type: 'presentation',
        attemptCount: 2,
        maxScore: 91,
        recentScore: 88,
        recentPracticeDate: '2026-08-04T10:00:00',
      }],
    })
    const store = usePracticeStore()

    await store.loadFolders({ type: 'presentation' })

    expect(store.folders[0]).toMatchObject({
      id: '41',
      reportCount: 2,
      best: 91,
      latestScore: 88,
      recentPracticeDate: '2026-08-04T10:00:00',
    })
  })

  test('does not let an older recent-practice response replace the current folder', async () => {
    let resolveFirst
    vi.spyOn(archiveApi, 'listPractices')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce({
        attemptCount: 1,
        practices: [{
          practiceId: 802,
          interviewId: 82,
          type: 'interview',
          title: '현재 면접',
          overallScore: 87,
          createdAt: '2026-08-04T12:00:00',
        }],
      })
    const store = usePracticeStore()

    const olderRequest = store.loadRecentPractices(7)
    await store.loadRecentPractices(8)
    resolveFirst({
      attemptCount: 1,
      practices: [{
        practiceId: 701,
        presentationId: 71,
        type: 'presentation',
        title: '이전 발표',
        overallScore: 55,
        createdAt: '2026-08-01T09:00:00',
      }],
    })
    await olderRequest

    expect(store.recentPractices).toEqual([
      expect.objectContaining({ id: '802', score: 87, title: '현재 면접' }),
    ])
    expect(store.recentPracticeCount).toBe(1)
  })

})

describe('presentationStore', () => {
  test('rejects an emoji practice title before creating a presentation', async () => {
    const create = vi.spyOn(presentationApi, 'create')
    const practice = usePracticeStore()
    practice.setFolder({ id: '77', name: '발표 폴더' })
    const store = usePresentationStore()
    store.setTitle('발표 😁')
    store.setDescription('설명')

    await expect(store.uploadPresentation(
      new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }),
      { pollIntervalMs: 0, maxAttempts: 1 },
    )).rejects.toThrow('이모지')

    expect(create).not.toHaveBeenCalled()
  })

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

  test('clamps target minutes to 1..30', () => {
    const store = usePresentationStore()
    store.setTargetMinutes(999)
    expect(store.targetMinutes).toBe(30)
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

  test('loads and normalizes a presentation report by presentation id', async () => {
    const getReport = vi.spyOn(presentationApi, 'getReport').mockResolvedValue({
      status: 'COMPLETED',
      practice: { practiceId: 31, title: 'API 발표', durationMs: 10_000 },
      presentation: { presentationId: 47, slideCount: 1 },
      score: { overallScore: 91, deliveryScore: 88 },
      slides: [],
    })
    const store = usePresentationStore()
    await store.loadReport('47')

    expect(getReport).toHaveBeenCalledWith(47)
    expect(store.report).toMatchObject({
      practice: { title: 'API 발표', durationSec: 10 },
      presentation: { presentationId: 47 },
      score: { overallScore: 91, voiceScore: 88 },
    })
  })

  test('rejects a presentation report lookup without a real presentation id', async () => {
    const store = usePresentationStore()

    await expect(store.loadReport('report-47')).rejects.toMatchObject({
      code: 'INVALID_SERVER_ID',
    })
  })
})

describe('interviewStore', () => {
  test('rejects an emoji practice title before creating an interview', async () => {
    const create = vi.spyOn(interviewApi, 'create')
    const practice = usePracticeStore()
    practice.setFolder({ id: '77', name: '면접 폴더' })
    const store = useInterviewStore()
    store.setInfo({ title: '면접 😁', description: '설명' })

    await expect(store.createInterview()).rejects.toThrow('이모지')

    expect(create).not.toHaveBeenCalled()
  })

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

  test('keeps at most 15 interview questions from the server response', async () => {
    vi.spyOn(interviewApi, 'create').mockResolvedValue({
      interviewId: 21,
      practiceId: 31,
      interviewerId: 2,
      questionItems: Array.from({ length: 17 }, (_, index) => ({
        questionId: index + 1,
        question: `server question ${index + 1}`,
      })),
    })
    const practice = usePracticeStore()
    practice.setFolder({ id: '77', name: 'interview folder' })
    const store = useInterviewStore()
    store.setInfo({ title: 'interview', companyId: '1' })
    store.setInterviewer({ id: '2', code: 'PRACTICAL' })

    await store.createInterview()

    expect(store.questionCount).toBe(15)
    expect(store.questions.at(-1)?.text).toBe('server question 15')
  })

  test('does not call the add-question API after reaching 15 questions', async () => {
    const addQuestion = vi.spyOn(interviewApi, 'addQuestion')
    const store = useInterviewStore()
    store.interviewId = 21
    store.setQuestions(Array.from({ length: 15 }, (_, index) => ({
      questionId: index + 1,
      text: `question ${index + 1}`,
    })))

    await expect(store.addQuestion('question 16')).rejects.toThrow('15')

    expect(addQuestion).not.toHaveBeenCalled()
    expect(store.questionCount).toBe(15)
  })

  test('uploads the recording blobs and answer segments when completing an interview', async () => {
    const complete = vi.spyOn(interviewApi, 'complete').mockResolvedValue({ overallScore: 91 })
    const store = useInterviewStore()
    store.interviewId = 21
    const blob = recordingBlob('video/webm')
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

  test('prefers exact millisecond answer boundaries in the complete request', async () => {
    const complete = vi.spyOn(interviewApi, 'complete').mockResolvedValue({ overallScore: 91 })
    const store = useInterviewStore()
    store.interviewId = 21
    const blob = recordingBlob('video/webm')
    const answers = [{
      questionId: 41,
      question: 'precise boundary question',
      answer: 'precise boundary answer',
      startTime: 1,
      endTime: 4,
      startTimeMs: 1_275,
      endTimeMs: 4_625,
    }]

    store.finishRecording({ blob, durationSeconds: 5, answers })
    await store.completeInterview()

    expect(complete).toHaveBeenCalledWith(21, expect.objectContaining({
      request: expect.objectContaining({
        answers: [expect.objectContaining({
          startTimeMs: 1_275,
          endTimeMs: 4_625,
        })],
      }),
    }))
  })

  test('blocks incomplete interview media before calling complete', async () => {
    const complete = vi.spyOn(interviewApi, 'complete').mockResolvedValue({})
    const store = useInterviewStore()
    store.interviewId = 21
    store.finishRecording({
      videoBlob: recordingBlob('video/webm'),
      audioBlob: new Blob([], { type: 'audio/wav' }),
      durationSeconds: 12,
      answers: [],
    })

    await expect(store.completeInterview()).rejects.toMatchObject({ code: 'AUDIO_TOO_SMALL' })
    expect(complete).not.toHaveBeenCalled()
  })

  test('coalesces concurrent interview complete calls', async () => {
    let resolveComplete
    const pending = new Promise((resolve) => { resolveComplete = resolve })
    const complete = vi.spyOn(interviewApi, 'complete').mockReturnValue(pending)
    const store = useInterviewStore()
    store.interviewId = 21
    store.finishRecording({
      videoBlob: recordingBlob('video/webm'),
      audioBlob: recordingBlob('audio/wav'),
      durationSeconds: 12,
      answers: [],
    })

    const first = store.completeInterview()
    const second = store.completeInterview()
    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce())
    resolveComplete({ overallScore: 91 })
    await Promise.all([first, second])

    expect(complete).toHaveBeenCalledOnce()
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

  test('fetches the selected report when a different interview report is cached', async () => {
    const getReport = vi.spyOn(interviewApi, 'getReport').mockResolvedValue({
      interviewId: 47,
      overallScore: 72,
      questions: [],
    })
    const store = useInterviewStore()
    store.report = {
      interviewId: 21,
      overallScore: 91,
      questions: [],
    }

    await store.loadReport('47')

    expect(getReport).toHaveBeenCalledWith('47')
    expect(store.report.interviewId).toBe(47)
  })

  test('does not hide a missing interview report endpoint with a demo report', async () => {
    const failure = Object.assign(new Error('not found'), { status: 404 })
    vi.spyOn(interviewApi, 'getReport').mockRejectedValue(failure)
    const store = useInterviewStore()

    await expect(store.loadReport('47')).rejects.toBe(failure)

    expect(store.report).toBeNull()
  })
})

describe('archiveStore', () => {
  test('add prepends a session and it becomes findable', () => {
    const store = useArchiveStore()
    store.add({ id: 'x1', type: 'presentation', title: '새 발표', date: '2026.07.25', time: '10:00', score: 91, duration: '3분' })
    expect(store.find('x1').score).toBe(91)
  })

  test('loads archive folders and preserves server pagination metadata', async () => {
    const list = vi.spyOn(archiveApi, 'listFolders').mockResolvedValue({
      totalElements: 32,
      currentPage: 0,
      totalPage: 6,
      hasNext: true,
      folders: [
        { folderId: 41, name: '서비스 발표', type: 'presentation', attemptCount: 2, maxScore: 91 },
      ],
    })
    const store = useArchiveStore()
    await store.loadFolders({ type: 'presentation', keyword: '서비스', page: 0 })

    expect(list).toHaveBeenCalledWith({ type: 'presentation', keyword: '서비스', page: 0 })
    expect(store.folders).toEqual([expect.objectContaining({ id: '41', name: '서비스 발표', best: 91 })])
    expect(store.pagination).toEqual({
      totalElements: 32,
      currentPage: 0,
      totalPage: 6,
      hasNext: true,
    })
  })

  test('clears stale server-backed archive state when the folder request fails', async () => {
    const failure = Object.assign(new Error('접근 권한이 없어요.'), { status: 403 })
    vi.spyOn(archiveApi, 'listFolders').mockRejectedValue(failure)
    const store = useArchiveStore()
    store.folders = [{ id: 'old', name: '이전 사용자 기록' }]
    store.pagination = { totalElements: 1, currentPage: 2, totalPage: 3, hasNext: true }
    store.selectedFolder = { id: 'old', name: '이전 사용자 기록' }
    store.practices = [{ id: 'old-practice' }]

    await expect(store.loadFolders()).rejects.toBe(failure)

    expect(store.folders).toEqual([])
    expect(store.pagination).toEqual({
      totalElements: 0,
      currentPage: 0,
      totalPage: 0,
      hasNext: false,
    })
    expect(store.selectedFolder).toBeNull()
    expect(store.practices).toEqual([])
  })

  test('loads a folder and its real practices without fabricating domain ids', async () => {
    vi.spyOn(archiveApi, 'getFolder').mockResolvedValue({
      folderId: 41,
      name: '서비스 발표',
      type: 'presentation',
      practiceCount: 1,
    })
    vi.spyOn(archiveApi, 'listPractices').mockResolvedValue({
      practices: [{
        practiceId: 35,
        presentationId: 12,
        title: '서비스 소개',
        durationSec: 40,
        createdAt: '2026-07-20T14:32:00',
      }],
    })
    const store = useArchiveStore()

    await store.loadFolder(41, { type: 'presentation' })
    await store.loadPractices(41)

    expect(store.selectedFolder).toMatchObject({ id: '41', name: '서비스 발표' })
    expect(store.practices).toEqual([
      expect.objectContaining({ id: '35', presentationId: 12, score: null }),
    ])
  })
})

describe('documentsStore', () => {
  test('loads and merges real resume and portfolio resources without id collisions', async () => {
    const resumeList = vi.spyOn(resumeApi, 'list').mockResolvedValue([
      { id: 10, title: '자소서', content: '본문', createdAt: '2026-07-20T00:00:00' },
    ])
    const portfolioList = vi.spyOn(portfolioApi, 'list').mockResolvedValue({
      data: [{ id: 10, title: '포트폴리오', summary: '요약', createdAt: '2026-07-21T00:00:00' }],
    })
    const store = useDocumentsStore()

    await store.loadDocuments()

    expect(resumeList).toHaveBeenCalledOnce()
    expect(portfolioList).toHaveBeenCalledOnce()
    expect(store.documents.map((item) => item.id)).toEqual(['portfolio:10', 'resume:10'])
    expect(store.find('resume:10')).toMatchObject({ serverId: 10, content: '본문' })
  })

  test('routes detail and delete operations through the composite document id', async () => {
    vi.spyOn(resumeApi, 'list').mockResolvedValue([])
    vi.spyOn(portfolioApi, 'list').mockResolvedValue([])
    const getResume = vi.spyOn(resumeApi, 'get').mockResolvedValue({
      id: 12,
      title: '상세 자소서',
      content: '상세 본문',
      createdAt: '2026-07-20T00:00:00',
    })
    const removePortfolio = vi.spyOn(portfolioApi, 'remove').mockResolvedValue('')
    const store = useDocumentsStore()

    const detail = await store.loadDocument('resume:12')
    store.portfolios = [{ id: 7, title: '삭제 대상', createdAt: '2026-07-21T00:00:00' }]
    await store.removeDocument('portfolio:7')

    expect(getResume).toHaveBeenCalledWith(12)
    expect(detail).toMatchObject({ id: 'resume:12', content: '상세 본문' })
    expect(removePortfolio).toHaveBeenCalledWith(7)
    expect(store.find('portfolio:7')).toBeNull()
  })

  test('uploads by selected type and refreshes only that resource list', async () => {
    const resumeList = vi.spyOn(resumeApi, 'list').mockResolvedValue([
      { id: 31, title: '새 자소서', createdAt: '2026-07-22T00:00:00' },
    ])
    const portfolioList = vi.spyOn(portfolioApi, 'list').mockResolvedValue([])
    const upload = vi.spyOn(resumeApi, 'upload').mockResolvedValue({ resumeId: 31 })
    const store = useDocumentsStore()
    const file = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })

    await store.uploadDocument({ type: 'resume', title: '새 자소서', file })

    expect(upload).toHaveBeenCalledWith({ title: '새 자소서', file })
    expect(resumeList).toHaveBeenCalledOnce()
    expect(portfolioList).not.toHaveBeenCalled()
    expect(store.documents[0]).toMatchObject({ id: 'resume:31', name: '새 자소서' })
  })

  test('rejects a support PDF over 50MB before calling the upload API', async () => {
    const upload = vi.spyOn(resumeApi, 'upload')
    const store = useDocumentsStore()
    const file = { name: 'oversized.pdf', type: 'application/pdf', size: 50 * 1024 * 1024 + 1 }

    await expect(store.uploadDocument({ type: 'resume', title: '대용량 자소서', file }))
      .rejects.toThrow('50MB')

    expect(upload).not.toHaveBeenCalled()
    expect(store.loading).toBe(false)
  })

  test('keeps portfolio results when the resume list fails', async () => {
    const failure = new Error('network down')
    vi.spyOn(resumeApi, 'list').mockRejectedValue(failure)
    vi.spyOn(portfolioApi, 'list').mockResolvedValue([
      { id: 21, title: '포트폴리오', createdAt: '2026-07-21T00:00:00' },
    ])
    const store = useDocumentsStore()
    store.resumes = [{ id: 99, title: '이전 자소서', createdAt: '2026-07-01T00:00:00' }]

    await expect(store.loadDocuments()).resolves.toHaveLength(1)

    expect(store.documents[0]).toMatchObject({ id: 'portfolio:21', name: '포트폴리오' })
    expect(store.error).toContain('자소서')
  })

  test('keeps resume results when the portfolio list fails', async () => {
    vi.spyOn(resumeApi, 'list').mockResolvedValue([
      { id: 11, title: '자소서', createdAt: '2026-07-20T00:00:00' },
    ])
    vi.spyOn(portfolioApi, 'list').mockRejectedValue(new Error('network down'))
    const store = useDocumentsStore()
    store.portfolios = [{ id: 99, title: '이전 포트폴리오', createdAt: '2026-07-01T00:00:00' }]

    await expect(store.loadDocuments()).resolves.toHaveLength(1)

    expect(store.documents[0]).toMatchObject({ id: 'resume:11', name: '자소서' })
    expect(store.error).toContain('포트폴리오')
  })

  test('rejects only when both support document lists fail', async () => {
    const resumeFailure = new Error('resume down')
    vi.spyOn(resumeApi, 'list').mockRejectedValue(resumeFailure)
    vi.spyOn(portfolioApi, 'list').mockRejectedValue(new Error('portfolio down'))
    const store = useDocumentsStore()

    await expect(store.loadDocuments()).rejects.toBe(resumeFailure)
    expect(store.error).toContain('자소서와 포트폴리오')
  })
})
