import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { interviewApi, readApiCollection, readApiValue, unwrapApiResponse } from '../api/index.js'
import { normalizeInterviewQuestions } from '../api/normalizers/interview.js'
import { buildInterviewSessionPayload } from '../api/payloads/interview.js'
import { withMock } from '../api/withMock.js'
import { SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { buildInterviewReportMock, interviewQuestionMocks } from '../mocks/interview.js'
import { createLocalId, createOpaqueLocalId } from '../utils/id.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'
import { usePracticeStore } from './practiceStore.js'

// v2: 기본값을 빈 값으로 바꾼 뒤부터, 이전(구 기본값이 채워진) 드래프트는 무시하고
// 빈 상태로 시작하도록 키를 올린다.
const FLOW_KEY = SESSION_STORAGE_KEYS.interviewFlow

const loadDraft = () => readJsonStorage(sessionStorage, FLOW_KEY, {}) || {}

const responseQuestions = (response) => normalizeInterviewQuestions(
  readApiCollection(response, ['questions', 'items', 'content']),
)

export const useInterviewStore = defineStore('interview', () => {
  const draft = loadDraft()
  const practice = usePracticeStore()

  const sessionId = ref(draft.sessionId ?? null)
  const sessionStatus = ref(draft.sessionStatus ?? 'draft')
  const title = ref(draft.title ?? '')
  const company = ref(draft.company ?? '')
  const field = ref(draft.field ?? '')
  const position = ref(draft.position ?? '')
  const careerLevel = ref(draft.careerLevel ?? '')
  const keywords = ref(draft.keywords ?? [])
  const resumeDocs = ref(draft.resumeDocs ?? [])
  const interviewerStyle = ref(draft.interviewerStyle ?? 'practical')
  const questions = ref(draft.questions ?? interviewQuestionMocks.map((q) => ({ ...q })))
  const recordedSeconds = ref(draft.recordedSeconds ?? 0)
  const recordingId = ref(draft.recordingId ?? null)
  const analysisStatus = ref(draft.analysisStatus ?? 'idle')
  const analysisProgress = ref(draft.analysisProgress ?? 0)
  const analysisError = ref('')
  const report = ref(null)
  const saving = ref(false)
  const saveError = ref('')

  let ensureSessionPromise = null

  const questionCount = computed(() => questions.value.length)
  const estimatedMinutes = computed(() => questions.value.reduce((sum, q) => sum + (q.min || 0), 0))

  watch(
    [sessionId, sessionStatus, title, company, field, position, careerLevel, keywords, resumeDocs,
      interviewerStyle, questions, recordedSeconds, recordingId, analysisStatus, analysisProgress],
    () => {
      writeJsonStorage(sessionStorage, FLOW_KEY, {
        sessionId: sessionId.value,
        sessionStatus: sessionStatus.value,
        title: title.value,
        company: company.value,
        field: field.value,
        position: position.value,
        careerLevel: careerLevel.value,
        keywords: keywords.value,
        resumeDocs: resumeDocs.value,
        interviewerStyle: interviewerStyle.value,
        questions: questions.value,
        recordedSeconds: recordedSeconds.value,
        recordingId: recordingId.value,
        analysisStatus: analysisStatus.value,
        analysisProgress: analysisProgress.value,
      })
    },
    { deep: true },
  )

  const setInfo = (patch) => {
    if (patch.title !== undefined) title.value = patch.title
    if (patch.company !== undefined) company.value = patch.company
    if (patch.field !== undefined) field.value = patch.field
    if (patch.position !== undefined) position.value = patch.position
    if (patch.careerLevel !== undefined) careerLevel.value = patch.careerLevel
    if (patch.keywords !== undefined) keywords.value = patch.keywords
  }
  const setResumeDocs = (docs) => { resumeDocs.value = [...docs] }
  const setInterviewerStyle = (style) => { interviewerStyle.value = style }
  const setQuestions = (list) => { questions.value = list.map((q) => ({ ...q })) }
  const setRecordedSeconds = (seconds) => { recordedSeconds.value = Math.max(0, Math.round(seconds)) }

  const sessionPayload = (overrides = {}) => buildInterviewSessionPayload({
    folderId: practice.folderId,
    title: title.value,
    company: company.value,
    field: field.value,
    position: position.value,
    careerLevel: careerLevel.value,
    keywords: keywords.value,
    resumeDocs: resumeDocs.value,
    interviewerStyle: interviewerStyle.value,
    questions: questions.value,
  }, overrides)

  const ensureSession = async () => {
    if (sessionId.value) return sessionId.value
    if (ensureSessionPromise) return ensureSessionPromise

    ensureSessionPromise = (async () => {
      const fallback = { sessionId: createOpaqueLocalId('interview'), status: 'DRAFT' }
      const response = await withMock(() => interviewApi.createSession(sessionPayload()), () => fallback)
      sessionId.value = readApiValue(response, ['sessionId', 'interviewSessionId', 'id'], fallback.sessionId)
      sessionStatus.value = String(unwrapApiResponse(response).status ?? 'draft').toLowerCase()
      return sessionId.value
    })().finally(() => { ensureSessionPromise = null })
    return ensureSessionPromise
  }

  const syncSession = async (overrides = {}) => {
    const id = await ensureSession()
    return withMock(
      () => interviewApi.updateSession(id, sessionPayload(overrides)),
      () => ({ sessionId: id, status: sessionStatus.value, ...sessionPayload(overrides) }),
    )
  }

  const saveSetup = async (files = []) => {
    saving.value = true
    saveError.value = ''
    try {
      const id = await ensureSession()
      await syncSession({ status: 'DRAFT' })
      for (const file of files) {
        await withMock(
          () => interviewApi.uploadResume(id, file),
          () => ({ documentId: `local-${file.name}`, fileName: file.name }),
        )
      }
      return id
    } catch (error) {
      saveError.value = error?.message || '면접 설정 저장에 실패했습니다.'
      throw error
    } finally {
      saving.value = false
    }
  }

  const saveStyleAndQuestions = async () => {
    saving.value = true
    saveError.value = ''
    try {
      return await syncSession({ interviewerStyle: interviewerStyle.value, questions: questions.value })
    } catch (error) {
      saveError.value = error?.message || '면접관과 질문 설정 저장에 실패했습니다.'
      throw error
    } finally {
      saving.value = false
    }
  }

  const loadQuestions = async () => {
    const id = await ensureSession()
    const response = await withMock(
      () => interviewApi.listQuestions(id),
      () => ({ questions: questions.value }),
    )
    const loaded = responseQuestions(response)
    if (loaded.length) setQuestions(loaded)
    return questions.value
  }

  const saveQuestions = async (list = questions.value) => {
    setQuestions(list)
    return saveStyleAndQuestions()
  }

  const finishRecording = async ({ blob, durationSeconds, answers = [] }) => {
    saving.value = true
    saveError.value = ''
    try {
      setRecordedSeconds(durationSeconds)
      const id = await ensureSession()
      const metadata = {
        durationSeconds: recordedSeconds.value,
        questionCount: questionCount.value,
        answers,
      }
      const fallback = { recordingId: createLocalId('local-recording'), status: 'RECORDED' }
      const response = await withMock(
        () => interviewApi.submitRecording(id, { blob, metadata }),
        () => fallback,
      )
      recordingId.value = readApiValue(response, ['recordingId', 'id'], fallback.recordingId)
      sessionStatus.value = 'recorded'
      await withMock(
        () => interviewApi.updateSession(id, sessionPayload({ status: 'RECORDED', recordingId: recordingId.value })),
        () => ({ sessionId: id, status: 'RECORDED' }),
      )
      return { recordingId: recordingId.value, metadata }
    } catch (error) {
      saveError.value = error?.message || '면접 녹화 파일 저장에 실패했습니다.'
      throw error
    } finally {
      saving.value = false
    }
  }

  const beginAnalysis = async () => {
    if (analysisStatus.value === 'processing' && sessionStatus.value === 'analyzing') return sessionId.value
    const id = await ensureSession()
    analysisStatus.value = 'processing'
    analysisProgress.value = 0
    analysisError.value = ''
    sessionStatus.value = 'analyzing'
    await withMock(
      () => interviewApi.completeSession(id, { recordedSeconds: recordedSeconds.value, questionCount: questionCount.value }),
      () => ({ sessionId: id, status: 'PROCESSING' }),
    )
    return id
  }

  const pollAnalysis = async () => {
    const id = await ensureSession()
    const mockProgress = Math.min(100, analysisProgress.value + 20)
    const response = await withMock(
      () => interviewApi.getAnalysis(id),
      () => ({ status: mockProgress >= 100 ? 'COMPLETED' : 'PROCESSING', progress: mockProgress }),
    )
    const value = unwrapApiResponse(response)
    const status = String(value.status ?? value.analysisStatus ?? 'PROCESSING').toLowerCase()
    analysisProgress.value = Math.max(0, Math.min(100, Number(value.progress ?? value.progressPercent ?? (status === 'completed' ? 100 : analysisProgress.value))))
    analysisStatus.value = status
    if (status === 'completed') {
      analysisProgress.value = 100
      sessionStatus.value = 'completed'
    }
    if (status === 'failed') analysisError.value = value.message ?? value.errorMessage ?? '면접 분석에 실패했습니다.'
    return { status: analysisStatus.value, progress: analysisProgress.value }
  }

  const loadReport = async () => {
    const id = await ensureSession()
    const mock = () => buildInterviewReportMock(74 + Math.floor(recordedSeconds.value % 20), recordedSeconds.value || 588)
    const response = await withMock(() => interviewApi.getReport(id), mock)
    report.value = unwrapApiResponse(response)
    return report.value
  }

  const retryAnalysis = async () => {
    analysisStatus.value = 'idle'
    analysisProgress.value = 0
    analysisError.value = ''
    return beginAnalysis()
  }

  const reset = () => {
    sessionId.value = null
    sessionStatus.value = 'draft'
    title.value = ''
    company.value = ''
    field.value = ''
    position.value = ''
    careerLevel.value = ''
    keywords.value = []
    resumeDocs.value = []
    interviewerStyle.value = 'practical'
    questions.value = interviewQuestionMocks.map((q) => ({ ...q }))
    recordedSeconds.value = 0
    recordingId.value = null
    analysisStatus.value = 'idle'
    analysisProgress.value = 0
    analysisError.value = ''
    report.value = null
    sessionStorage.removeItem(FLOW_KEY)
  }

  return {
    sessionId, sessionStatus, title, company, field, position, careerLevel, keywords, resumeDocs,
    interviewerStyle, questions, recordedSeconds, recordingId, analysisStatus, analysisProgress, analysisError,
    report, saving, saveError, questionCount, estimatedMinutes,
    setInfo, setResumeDocs, setInterviewerStyle, setQuestions, setRecordedSeconds,
    ensureSession, syncSession, saveSetup, saveStyleAndQuestions, loadQuestions, saveQuestions, finishRecording,
    beginAnalysis, pollAnalysis, retryAnalysis, loadReport, reset,
  }
})
