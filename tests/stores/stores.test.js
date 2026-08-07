import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { archiveApi, documentApi, get, interviewApi, practiceApi, presentationApi } from '../../src/api/index.js'
import { usePresentationStore } from '../../src/stores/presentationStore.js'
import { useInterviewStore } from '../../src/stores/interviewStore.js'
import { useArchiveStore } from '../../src/stores/archiveStore.js'
import { useDocumentsStore } from '../../src/stores/documentsStore.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'

const createStoredPptx = () => {
  const encoder = new TextEncoder()
  const entries = [
    ['ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?>
      <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
        <p:sldSz cx="12192000" cy="6858000"/>
      </p:presentation>`],
    ['ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Target="slides/slide1.xml"
          Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"/>
      </Relationships>`],
    ['ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="500000" y="500000"/>
          <a:ext cx="8000000" cy="1200000"/></a:xfrm></p:spPr><p:txBody><a:p>
          <a:r><a:rPr sz="3200" b="1"/><a:t>실제 업로드 슬라이드</a:t></a:r>
          </a:p></p:txBody></p:sp></p:spTree></p:cSld>
      </p:sld>`],
  ].map(([name, content]) => ({ nameBytes: encoder.encode(name), data: encoder.encode(content) }))

  const localParts = []
  const centralParts = []
  let localOffset = 0
  entries.forEach(({ nameBytes, data }) => {
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    localParts.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint32(42, localOffset, true)
    central.set(nameBytes, 46)
    centralParts.push(central)
    localOffset += local.length
  })

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, localOffset, true)
  const bytes = new Uint8Array(localOffset + centralSize + end.length)
  let offset = 0
  ;[...localParts, ...centralParts, end].forEach((part) => {
    bytes.set(part, offset)
    offset += part.length
  })

  const file = new File([bytes], 'demo.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer.slice(0) })
  return file
}

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

describe('practiceStore', () => {
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

  test('passes the selected folder id to presentation and interview sessions', async () => {
    const createPresentation = vi.spyOn(presentationApi, 'createSession')
      .mockResolvedValue({ data: { sessionId: 'p-1', status: 'DRAFT' } })
    const createInterview = vi.spyOn(interviewApi, 'createSession')
      .mockResolvedValue({ data: { sessionId: 'i-1', status: 'DRAFT' } })
    const practice = usePracticeStore()
    practice.setFolder({ id: 'folder-77', name: '취업 준비' })

    await usePresentationStore().ensureSession()
    await useInterviewStore().ensureSession()

    expect(createPresentation).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'folder-77' }))
    expect(createInterview).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'folder-77' }))
  })
})

describe('presentationStore', () => {
  test('clears a local upload that cannot be restored after refresh', () => {
    sessionStorage.setItem('aivo.presentation-flow', JSON.stringify({
      sessionId: 'local-session-before-refresh',
      sourceFile: { name: 'large-deck.pptx', size: 28964605 },
      uploadStatus: 'ready',
      slides: [{ id: 1, number: 1, title: '로컬 슬라이드', previewUrl: 'blob:http://localhost/stale-preview' }],
    }))

    const store = usePresentationStore()

    expect(store.sourceFile).toBeNull()
    expect(store.uploadStatus).toBe('idle')
    expect(store.slides).toHaveLength(0)
    expect(store.hasRenderableSlides).toBe(false)
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

  test('persists the local session, upload, slide timeline, and completion flow', async () => {
    const store = usePresentationStore()
    const file = new File(['pdf'], 'demo.pdf', { type: 'application/pdf' })
    vi.spyOn(presentationApi, 'uploadSlides').mockResolvedValue({
      data: {
        result: {
          slides: [
            { slideId: 'slide-1', slideNumber: 1, title: '표지', imageUrl: '/uploads/demo/1.png', extractedText: '서비스 소개' },
            { slideId: 'slide-2', slideNumber: 2, title: '문제 정의', thumbnailUrl: '/uploads/demo/2.png' },
          ],
        },
      },
    })

    await store.uploadPresentation(file)
    expect(store.sessionId).toMatch(/^local-session-/)
    expect(store.uploadStatus).toBe('ready')
    expect(store.sourceFile.name).toBe('demo.pdf')
    expect(store.hasRenderableSlides).toBe(true)
    expect(store.slides).toMatchObject([
      { id: 'slide-1', number: 1, previewUrl: '/uploads/demo/1.png', extractedText: '서비스 소개' },
      { id: 'slide-2', number: 2, previewUrl: '/uploads/demo/2.png' },
    ])

    await store.startRecordingSession()
    await store.recordSlideTransition(0, 1, 4)
    store.addTranscriptEvent({ text: '두 번째 슬라이드 설명', slideIndex: 1, atSeconds: 5 })
    await store.finishRecording({
      blob: null,
      durationSeconds: 10,
      metrics: { wpm: 120, gazeHold: 82, posture: 88, fillerCount: 1, voice: '안정' },
      complete: true,
    })

    expect(store.sessionStatus).toBe('completed')
    expect(store.slideTimeline).toHaveLength(2)
    expect(store.slideTimeline[1].durationSeconds).toBe(6)
    expect(store.transcriptEvents[0].slideIndex).toBe(1)
    expect(store.recordingId).toMatch(/^local-recording-/)
  })

  test('renders the actual PPTX locally when the API has no preview images', async () => {
    vi.spyOn(presentationApi, 'uploadSlides').mockResolvedValue({
      data: { slides: [{ slideId: 1, title: '서버 추출 제목' }] },
    })
    const store = usePresentationStore()
    const file = createStoredPptx()

    await store.uploadPresentation(file)

    expect(store.uploadStatus).toBe('ready')
    expect(store.slides).toHaveLength(1)
    expect(store.slides[0]).toMatchObject({ title: '서버 추출 제목', extractedText: '실제 업로드 슬라이드' })
    expect(store.slides[0].previewUrl).toMatch(/^(blob:|data:image\/svg\+xml)/)
    expect(store.hasRenderableSlides).toBe(true)
  })

  test('keeps uploaded slides in the report when the report API omits them', async () => {
    vi.spyOn(presentationApi, 'getReport').mockResolvedValue({ data: { overallScore: 90 } })
    const store = usePresentationStore()
    store.setSlides([{ slideId: 's-1', title: '업로드 슬라이드', imageUrl: '/slides/s-1.png' }])

    await store.loadReport()

    expect(store.report.slides[0]).toMatchObject({ id: 's-1', previewUrl: '/slides/s-1.png' })
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

  test('uses one server session for setup, questions, analysis, and report', async () => {
    vi.spyOn(interviewApi, 'createSession').mockResolvedValue({ data: { sessionId: 'server-interview-1', status: 'DRAFT' } })
    const update = vi.spyOn(interviewApi, 'updateSession').mockResolvedValue({ data: { status: 'DRAFT' } })
    vi.spyOn(interviewApi, 'listQuestions').mockResolvedValue({ data: { questions: [{ questionId: 'q-1', question: '서버 질문', category: '기술', estimatedMinutes: 3 }] } })
    const complete = vi.spyOn(interviewApi, 'completeSession').mockResolvedValue({ data: { status: 'PROCESSING' } })
    vi.spyOn(interviewApi, 'getAnalysis').mockResolvedValue({ data: { status: 'COMPLETED', progress: 100 } })
    const getReport = vi.spyOn(interviewApi, 'getReport').mockResolvedValue({ data: { overallScore: 91 } })

    const store = useInterviewStore()
    store.setInfo({ title: '서버 연동 면접', company: 'A사' })
    await store.saveSetup()
    expect(store.sessionId).toBe('server-interview-1')
    expect(update).toHaveBeenCalledWith('server-interview-1', expect.objectContaining({ title: '서버 연동 면접' }))

    await store.loadQuestions()
    expect(store.questions[0].text).toBe('서버 질문')
    await store.beginAnalysis()
    await store.pollAnalysis()
    await store.loadReport()

    expect(complete).toHaveBeenCalledWith('server-interview-1', expect.any(Object))
    expect(getReport).toHaveBeenCalledWith('server-interview-1')
    expect(store.analysisStatus).toBe('completed')
    expect(store.report.overallScore).toBe(91)
  })

  test('uploads the recording blob and answer segments before analysis', async () => {
    vi.spyOn(interviewApi, 'createSession').mockResolvedValue({ data: { sessionId: 'server-interview-2', status: 'DRAFT' } })
    const submit = vi.spyOn(interviewApi, 'submitRecording').mockResolvedValue({ data: { recordingId: 'recording-9' } })
    vi.spyOn(interviewApi, 'updateSession').mockResolvedValue({ data: { status: 'RECORDED' } })
    const store = useInterviewStore()
    const blob = new Blob(['recorded'], { type: 'video/webm' })
    const answers = [{ questionIndex: 0, startedAtSeconds: 1, endedAtSeconds: 12 }]

    await store.finishRecording({ blob, durationSeconds: 12, answers })

    expect(submit).toHaveBeenCalledWith('server-interview-2', {
      blob,
      metadata: expect.objectContaining({ durationSeconds: 12, answers }),
    })
    expect(store.recordingId).toBe('recording-9')
    expect(store.sessionStatus).toBe('recorded')
  })
})

describe('archiveStore', () => {
  test('groups seed sessions into folders with best score', () => {
    const store = useArchiveStore()
    expect(store.folders.length).toBeGreaterThan(0)
    const folder = store.folderByTitle('서비스 소개 발표')
    expect(folder).toBeTruthy()
    expect(folder.best).toBe(91)
    expect(folder.type).toBe('presentation')
  })

  test('add prepends a session and it becomes findable', () => {
    const store = useArchiveStore()
    store.add({ id: 'x1', type: 'presentation', title: '새 발표', date: '2026.07.25', time: '10:00', score: 91, duration: '3분' })
    expect(store.find('x1').score).toBe(91)
  })

  test('loads search and type results from the archive API', async () => {
    const list = vi.spyOn(archiveApi, 'listRecords').mockResolvedValue({
      data: { records: [{ reportId: 7, practiceType: 'INTERVIEW', folderName: '카카오 면접', overallScore: 93, createdAt: '2026-07-26T10:30:00' }] },
    })
    const store = useArchiveStore()
    await store.loadRecords({ type: 'interview', keyword: '카카오' })

    expect(list).toHaveBeenCalledWith({ type: 'interview', keyword: '카카오' })
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0]).toMatchObject({ id: '7', type: 'interview', title: '카카오 면접', score: 93 })
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
