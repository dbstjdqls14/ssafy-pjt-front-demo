import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { INPUT_LIMITS } from '../constants/inputLimits.js'

import { getAccessToken } from '../api/authToken.js'
import { interviewApi, portfolioApi, readApiCollection, resumeApi, unwrapApiResponse } from '../api/index.js'
import { normalizeInterviewQuestions } from '../api/normalizers/interview.js'
import { normalizePortfolios, normalizeResumes } from '../api/normalizers/interviewDocuments.js'
import { parseOptionalServerId, parseServerIdList } from '../api/serverId.js'
import { SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { clearActiveRecording } from '../utils/recordingRefreshRecovery.js'
import { assertCompleteMedia } from '../utils/recordingValidation.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'
import { TEXT_INPUT_POLICIES, textPolicyValidationMessage } from '../utils/textInputPolicy.js'
import { practiceTitleValidationMessage } from '../utils/validators.js'
import { usePracticeStore } from './practiceStore.js'

// v2: 기본값을 빈 값으로 바꾼 뒤부터, 이전(구 기본값이 채워진) 드래프트는 무시하고
// 빈 상태로 시작하도록 키를 올린다.
const FLOW_KEY = SESSION_STORAGE_KEYS.interviewFlow

const loadDraft = () => readJsonStorage(sessionStorage, FLOW_KEY, {}) || {}

// 백엔드 면접관 code → 프론트 페르소나 비주얼 키. 얼굴 이미지·톤 색상·예시 문구는
// 프론트 자산이므로(profileImageUrl이 아직 null) code 기준으로 이어 붙인다.
export const INTERVIEWER_STYLE_BY_CODE = {
  PRACTICAL: 'practical',
  GROWTH_COACH: 'growth',
  PRESSURE: 'pressure',
}

const limitInterviewQuestions = (list) => (
  Array.isArray(list) ? list.slice(0, INPUT_LIMITS.INTERVIEW_QUESTIONS_MAX) : []
)

export const useInterviewStore = defineStore('interview', () => {
  const draft = loadDraft()
  const practice = usePracticeStore()

  // ── 면접 설정(드래프트로 유지) ──
  const interviewId = ref(draft.interviewId ?? null)
  const practiceId = ref(draft.practiceId ?? null)
  const title = ref(draft.title ?? '')
  const description = ref(draft.description ?? '')
  const companyId = ref(draft.companyId ?? null)
  const company = ref(draft.company ?? '')
  const occupationId = ref(draft.occupationId ?? null)
  const field = ref(draft.field ?? '')
  const jobId = ref(draft.jobId ?? null)
  const position = ref(draft.position ?? '')
  const careerLevel = ref(draft.careerLevel ?? '')
  const keywords = ref(draft.keywords ?? [])
  // 이 면접에 첨부하기로 고른 자소서/포트폴리오. { id, title } — 서버가 파일
  // 크기를 안 주므로 목록엔 제목만 있다.
  const resumeDocs = ref(draft.resumeDocs ?? [])
  const portfolioDocs = ref(draft.portfolioDocs ?? [])
  const interviewerId = ref(draft.interviewerId ?? null)
  const interviewerStyle = ref(draft.interviewerStyle ?? 'practical')
  const questions = ref(limitInterviewQuestions(draft.questions))
  const questionFeedbacks = ref({})
  // 이 설정으로 이미 생성했는지 판별(뒤로 갔다 와도 같은 설정이면 재생성하지 않는다).
  const createdSignature = ref(draft.createdSignature ?? '')
  // 장치 확인 + 질문 확인을 한 번 끝냈는지. '다시 편집하러 가기'로 돌아왔다 와도
  // 같은 확인을 처음부터 다시 하지 않게 세션에 남긴다(발표 흐름과 동일).
  const preflightDone = ref(draft.preflightDone === true)

  // ── 녹화 결과 ──
  const recordedSeconds = ref(draft.recordedSeconds ?? 0)
  const answers = ref(draft.answers ?? [])
  // 블롭은 직렬화 불가 → 메모리에만 둔다(새로고침 시 유실).
  const sessionAudioBlob = ref(null)
  const sessionVideoBlob = ref(null)
  const sessionVideoOwnerId = ref(null)
  // MediaPipe 시선·자세 세션 요약(백엔드가 피드백에 참고할 비언어 통계).
  const sessionNonverbal = ref(null)
  // ── 분석(complete)·리포트 ──
  const analysisStatus = ref('idle')
  const analysisProgress = ref(0)
  const analysisError = ref('')
  const reportJob = ref(null)
  const report = ref(null)
  let completeInterviewPromise = null
  let analysisCompletePromise = null
  let reportRequestGeneration = 0

  // ── 조회 목록(카탈로그, 드래프트 저장 안 함) ──
  const companies = ref([])
  const occupations = ref([])
  const jobs = ref([])
  const interviewers = ref([])
  const catalogError = ref('')

  // ── 지원 자료(자소서·포트폴리오) 카탈로그 + 업로드 상태 ──
  const resumeCatalog = ref([])
  const portfolioCatalog = ref([])
  const docsSaving = ref(false)
  const docsError = ref('')

  const saving = ref(false)
  const saveError = ref('')

  const questionCount = computed(() => questions.value.length)
  const estimatedMinutes = computed(() => questions.value.reduce((sum, q) => sum + (q.min || 0), 0))

  watch(
    [interviewId, practiceId, title, description, companyId, company, occupationId, field, jobId, position,
      careerLevel, keywords, resumeDocs, portfolioDocs, interviewerId, interviewerStyle, questions,
      createdSignature, preflightDone, recordedSeconds, answers],
    () => {
      writeJsonStorage(sessionStorage, FLOW_KEY, {
        interviewId: interviewId.value,
        practiceId: practiceId.value,
        title: title.value,
        description: description.value,
        companyId: companyId.value,
        company: company.value,
        occupationId: occupationId.value,
        field: field.value,
        jobId: jobId.value,
        position: position.value,
        careerLevel: careerLevel.value,
        keywords: keywords.value,
        resumeDocs: resumeDocs.value,
        portfolioDocs: portfolioDocs.value,
        interviewerId: interviewerId.value,
        interviewerStyle: interviewerStyle.value,
        questions: questions.value,
        createdSignature: createdSignature.value,
        preflightDone: preflightDone.value,
        recordedSeconds: recordedSeconds.value,
        answers: answers.value,
      })
    },
    { deep: true },
  )

  // ── 카탈로그 로드(무인증 공개 API) ──
  const normalizeCatalog = (response) => readApiCollection(response, ['items', 'content'])

  const loadCompanies = async () => {
    if (companies.value.length) return companies.value
    const response = await interviewApi.listCompanies()
    companies.value = normalizeCatalog(response)
    return companies.value
  }

  const loadOccupations = async () => {
    if (occupations.value.length) return occupations.value
    const response = await interviewApi.listOccupations()
    occupations.value = normalizeCatalog(response)
    return occupations.value
  }

  const loadJobs = async (nextOccupationId = occupationId.value) => {
    if (!nextOccupationId) {
      jobs.value = []
      return jobs.value
    }
    const response = await interviewApi.listOccupationJobs(nextOccupationId)
    jobs.value = normalizeCatalog(response)
    return jobs.value
  }

  const loadInterviewers = async () => {
    if (interviewers.value.length) return interviewers.value
    const response = await interviewApi.listInterviewers()
    interviewers.value = normalizeCatalog(response)
    return interviewers.value
  }

  // ── 지원 자료(자소서·포트폴리오): 조회는 Bearer 필수라 비로그인이면 건너뛴다 ──
  const loadResumeCatalog = async () => {
    if (!getAccessToken() || resumeCatalog.value.length) return resumeCatalog.value
    docsError.value = ''
    try {
      const response = await resumeApi.list()
      resumeCatalog.value = normalizeResumes(readApiCollection(response, ['items', 'content']))
    } catch (error) {
      docsError.value = error?.message || '자기소개서 목록을 불러오지 못했습니다.'
    }
    return resumeCatalog.value
  }

  const loadPortfolioCatalog = async () => {
    if (!getAccessToken() || portfolioCatalog.value.length) return portfolioCatalog.value
    docsError.value = ''
    try {
      const response = await portfolioApi.list()
      portfolioCatalog.value = normalizePortfolios(readApiCollection(response, ['items', 'content']))
    } catch (error) {
      docsError.value = error?.message || '포트폴리오 목록을 불러오지 못했습니다.'
    }
    return portfolioCatalog.value
  }

  const uploadResumeDoc = async ({ title: docTitle, file }) => {
    docsSaving.value = true
    docsError.value = ''
    try {
      const response = await resumeApi.upload({ title: docTitle, file })
      const value = unwrapApiResponse(response)
      const created = normalizeResumes([{ resumeId: value.resumeId, title: docTitle, resumePath: value.resumePath }])[0]
      resumeCatalog.value = [created, ...resumeCatalog.value]
      resumeDocs.value = [...resumeDocs.value, created]
      return created
    } catch (error) {
      docsError.value = error?.message || '자기소개서 등록에 실패했습니다.'
      throw error
    } finally {
      docsSaving.value = false
    }
  }

  const uploadPortfolioDoc = async ({ title: docTitle, file }) => {
    docsSaving.value = true
    docsError.value = ''
    try {
      const response = await portfolioApi.upload({ title: docTitle, file })
      const value = unwrapApiResponse(response)
      const created = normalizePortfolios([{ portfolioId: value.portfolioId, title: docTitle, portfolioPath: value.portfolioPath }])[0]
      portfolioCatalog.value = [created, ...portfolioCatalog.value]
      portfolioDocs.value = [...portfolioDocs.value, created]
      return created
    } catch (error) {
      docsError.value = error?.message || '포트폴리오 등록에 실패했습니다.'
      throw error
    } finally {
      docsSaving.value = false
    }
  }

  const deleteResumeDoc = async (resumeId) => {
    docsSaving.value = true
    docsError.value = ''
    try {
      await resumeApi.remove(resumeId)
      resumeCatalog.value = resumeCatalog.value.filter((doc) => String(doc.id) !== String(resumeId))
      resumeDocs.value = resumeDocs.value.filter((doc) => String(doc.id) !== String(resumeId))
    } catch (error) {
      docsError.value = error?.message || '자기소개서 삭제에 실패했습니다.'
      throw error
    } finally {
      docsSaving.value = false
    }
  }

  const deletePortfolioDoc = async (portfolioId) => {
    docsSaving.value = true
    docsError.value = ''
    try {
      await portfolioApi.remove(portfolioId)
      portfolioCatalog.value = portfolioCatalog.value.filter((doc) => String(doc.id) !== String(portfolioId))
      portfolioDocs.value = portfolioDocs.value.filter((doc) => String(doc.id) !== String(portfolioId))
    } catch (error) {
      docsError.value = error?.message || '포트폴리오 삭제에 실패했습니다.'
      throw error
    } finally {
      docsSaving.value = false
    }
  }

  // 선택 해제일 뿐 서버 자료 자체는 지우지 않는다(다른 면접에서도 재사용 가능).
  const setResumeSelection = (docs) => { resumeDocs.value = docs.map((d) => ({ ...d })) }
  const setPortfolioSelection = (docs) => { portfolioDocs.value = docs.map((d) => ({ ...d })) }

  // ── 설정 변경 ──
  const setInfo = (patch) => {
    if (patch.title !== undefined) title.value = patch.title
    if (patch.description !== undefined) description.value = String(patch.description ?? '')
    if (patch.companyId !== undefined) companyId.value = patch.companyId
    if (patch.company !== undefined) company.value = patch.company
    if (patch.occupationId !== undefined) occupationId.value = patch.occupationId
    if (patch.field !== undefined) field.value = patch.field
    if (patch.jobId !== undefined) jobId.value = patch.jobId
    if (patch.position !== undefined) position.value = patch.position
    if (patch.careerLevel !== undefined) careerLevel.value = patch.careerLevel
    if (patch.keywords !== undefined) keywords.value = patch.keywords
  }
  const setInterviewer = (interviewer) => {
    interviewerId.value = interviewer?.id ?? null
    interviewerStyle.value = INTERVIEWER_STYLE_BY_CODE[interviewer?.code] ?? 'practical'
  }
  const setQuestions = (list) => {
    questions.value = limitInterviewQuestions(list).map((q) => ({ ...q }))
  }
  const setPreflightDone = (value = true) => { preflightDone.value = Boolean(value) }
  const setRecordedSeconds = (seconds) => { recordedSeconds.value = Math.max(0, Math.round(seconds)) }

  // ── 면접 생성(질문 AI 자동 생성 포함) ──
  const configSignature = () => JSON.stringify([
    practice.folderId, title.value, companyId.value, occupationId.value, jobId.value,
    careerLevel.value, interviewerId.value,
    resumeDocs.value.map((d) => d.id), portfolioDocs.value.map((d) => d.id),
  ])

  const loadQuestions = async (id = interviewId.value) => {
    if (!id) return questions.value
    const response = await interviewApi.getQuestions(id)
    questions.value = limitInterviewQuestions(
      normalizeInterviewQuestions(readApiCollection(response, ['questions', 'items', 'content'])),
    )
    return questions.value
  }

  const loadQuestionFeedback = async (questionId, id = interviewId.value) => {
    if (!id || !questionId) return null
    const response = unwrapApiResponse(await interviewApi.getQuestionFeedback(id, questionId))
    questionFeedbacks.value = { ...questionFeedbacks.value, [questionId]: response }
    return response
  }

  const createInterview = async ({ force = false } = {}) => {
    if (!force && interviewId.value && createdSignature.value === configSignature()) {
      if (!questions.value.length) await loadQuestions(interviewId.value)
      if (questions.value.length) {
        return { interviewId: interviewId.value, questions: questions.value, reused: true }
      }
    }
    saving.value = true
    saveError.value = ''
    try {
      const titleValidationError = title.value.trim()
        ? practiceTitleValidationMessage(title.value)
        : ''
      if (titleValidationError) throw new Error(titleValidationError)
      const descriptionValidationError = textPolicyValidationMessage(description.value, {
        policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
        maxLength: INPUT_LIMITS.PRACTICE_DESCRIPTION,
      })
      if (descriptionValidationError) throw new Error(descriptionValidationError)
      const payload = {
        companyId: parseOptionalServerId(companyId.value, '회사'),
        occupationId: parseOptionalServerId(occupationId.value, '직군'),
        jobId: parseOptionalServerId(jobId.value, '직무'),
        workExperience: careerLevel.value || undefined,
        title: title.value || undefined,
        // InterviewStartRequest의 description 지원이 backend-develop에 머지되어
        // 생성 시점부터 서버에 함께 저장한다.
        description: description.value.trim() || undefined,
        folderId: parseOptionalServerId(practice.folderId, '연습 폴더'),
        portfolioIds: parseServerIdList(portfolioDocs.value.map((doc) => doc.id), '포트폴리오'),
        resumeIds: parseServerIdList(resumeDocs.value.map((doc) => doc.id), '자기소개서'),
        interviewerId: parseOptionalServerId(interviewerId.value, '면접관'),
      }
      const response = await interviewApi.create(payload)
      const value = unwrapApiResponse(response)
      interviewId.value = value.interviewId ?? value.id ?? interviewId.value
      practiceId.value = value.practiceId ?? practiceId.value
      if (value.interviewerId != null) interviewerId.value = value.interviewerId
      questions.value = limitInterviewQuestions(
        normalizeInterviewQuestions(value.questionItems ?? value.questions ?? []),
      )
      questionFeedbacks.value = {}
      createdSignature.value = configSignature()
      // 새 면접이면 장치·질문 확인도 처음부터 다시 해야 한다.
      preflightDone.value = false
      // 새 면접이므로 이전 녹화·리포트 상태는 비운다.
      answers.value = []
      recordedSeconds.value = 0
      reportJob.value = null
      report.value = null
      analysisStatus.value = 'idle'
      analysisProgress.value = 0
      analysisError.value = ''
      return { interviewId: interviewId.value, questions: questions.value, reused: false }
    } catch (error) {
      saveError.value = error?.message || '면접 생성에 실패했습니다.'
      throw error
    } finally {
      saving.value = false
    }
  }

  // ── 질문 추가/삭제(서버 반영) ──
  const addQuestion = async (text) => {
    const question = String(text ?? '').trim()
    if (!question) return null
    const questionValidationError = textPolicyValidationMessage(question, {
      policy: TEXT_INPUT_POLICIES.SINGLE_LINE_PROSE,
      maxLength: INPUT_LIMITS.QUESTION,
    })
    if (questionValidationError) throw new Error(questionValidationError)
    if (questions.value.length >= INPUT_LIMITS.INTERVIEW_QUESTIONS_MAX) {
      throw new Error(`면접 질문은 최대 ${INPUT_LIMITS.INTERVIEW_QUESTIONS_MAX}개까지 등록할 수 있습니다.`)
    }
    const response = await interviewApi.addQuestion(interviewId.value, question)
    const value = unwrapApiResponse(response)
    const added = {
      questionId: value.questionId ?? value.id,
      text: value.question ?? question,
      cat: '직접 추가',
      min: 2,
    }
    questions.value = [...questions.value, added]
    return added
  }

  const removeQuestion = async (questionId) => {
    await interviewApi.removeQuestion(interviewId.value, questionId)
    questions.value = questions.value.filter((q) => q.questionId !== questionId)
  }

  // ── 녹화 종료: 결과를 스토어에 보관(업로드는 complete에서 한 번에) ──
  const finishRecording = ({ videoBlob = null, audioBlob = null, blob = null, durationSeconds = 0, answers: nextAnswers = [], nonverbal = null }) => {
    setRecordedSeconds(durationSeconds)
    sessionVideoBlob.value = videoBlob ?? blob
    sessionVideoOwnerId.value = sessionVideoBlob.value ? interviewId.value : null
    sessionAudioBlob.value = audioBlob ?? videoBlob ?? blob
    sessionNonverbal.value = nonverbal
    answers.value = nextAnswers.map((answer) => ({ ...answer }))
    analysisStatus.value = 'idle'
    analysisProgress.value = 0
    analysisError.value = ''
    reportJob.value = null
    report.value = null
  }

  // ── 질문 구간 오디오 비언어 분석(녹화 중 실시간 표시용) ──
  // 실패해도 면접 진행을 막지 않는다(라이브 패널 데이터일 뿐).
  const analyzeAnswerAudio = async ({ blob, sequence }) => {
    if (!practiceId.value || !blob) return null
    try {
      const response = await interviewApi.analyzeAudio(practiceId.value, { blob, sequence })
      return unwrapApiResponse(response)
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.info('[AIVO] audio-analysis 실패(무시하고 진행):', error?.message ?? error)
      }
      return null
    }
  }

  // ── 면접 종료(complete): 리포트가 동기 반환된다(폴링 없음) ──
  const completeInterview = () => {
    if (completeInterviewPromise) return completeInterviewPromise

    completeInterviewPromise = (async () => {
      assertCompleteMedia({
        durationSeconds: recordedSeconds.value,
        audioBlob: sessionAudioBlob.value,
        videoBlob: sessionVideoBlob.value,
      })
      const request = {
        durationSec: recordedSeconds.value,
        answers: answers.value.map((answer) => {
          const startTimeMs = Number(answer.startTimeMs)
          const endTimeMs = Number(answer.endTimeMs)
          return {
            questionId: answer.questionId ?? null,
            question: answer.question ?? '',
            answer: answer.answer ?? '',
            startTime: answer.startTime ?? null,
            endTime: answer.endTime ?? null,
            ...(Number.isFinite(startTimeMs) ? { startTimeMs: Math.max(0, Math.round(startTimeMs)) } : {}),
            ...(Number.isFinite(endTimeMs) ? { endTimeMs: Math.max(0, Math.round(endTimeMs)) } : {}),
          }
        }),
        // MediaPipe로 브라우저에서 측정한 시선·자세 세션 요약 — 백엔드 피드백 요청 반영.
        nonverbal: sessionNonverbal.value,
      }
      let response
      try {
        response = await interviewApi.complete(interviewId.value, {
          request,
          blob: sessionAudioBlob.value,
          videoBlob: sessionVideoBlob.value,
        })
      } catch (error) {
        // 서버의 전체 오디오 STT가 실패하면(AUDIO_STT_FAILED) 프론트 자막으로
        // 모은 answers 텍스트만으로 재시도한다 — 같은 실제 API를 다시 호출하며,
        // 가짜 리포트로 성공 처리하지 않는다.
        if (!(sessionAudioBlob.value && error?.code === 'AUDIO_STT_FAILED')) throw error
        response = await interviewApi.complete(interviewId.value, { request, blob: null, videoBlob: sessionVideoBlob.value })
      }
      reportJob.value = unwrapApiResponse(response)
      if (reportJob.value && typeof reportJob.value === 'object' && 'overallScore' in reportJob.value) {
        report.value = reportJob.value
      }
      return reportJob.value
    })()

    return completeInterviewPromise.finally(() => {
      completeInterviewPromise = null
    })
  }

  // AnalyzingView가 쓰는 어댑터: complete를 비동기로 돌려 두고 진행률을 흉내 낸다
  // (백엔드에 진행률 API가 없고 complete가 끝나는 순간이 곧 분석 완료다).
  const beginAnalysis = async () => {
    if (analysisStatus.value === 'processing') return interviewId.value
    analysisStatus.value = 'processing'
    analysisProgress.value = 0
    analysisError.value = ''
    analysisCompletePromise = completeInterview()
      .catch((error) => {
        analysisStatus.value = 'failed'
        analysisError.value = error?.message || '면접 분석에 실패했습니다.'
      })
    return interviewId.value
  }

  const pollAnalysis = async () => {
    if (!interviewId.value) {
      return { status: analysisStatus.value, progress: analysisProgress.value }
    }

    try {
      const statusResponse = unwrapApiResponse(await interviewApi.getReportStatus(interviewId.value))
      reportJob.value = statusResponse
      const serverStatus = statusResponse?.status

      if (serverStatus === 'COMPLETED') {
        analysisStatus.value = 'completed'
        analysisProgress.value = 100
      } else if (serverStatus === 'FAILED') {
        analysisStatus.value = 'failed'
        analysisError.value = statusResponse?.errorMessage || '면접 분석에 실패했습니다.'
      } else {
        analysisStatus.value = 'processing'
        const progressByStatus = {
          PENDING: 10,
          STT_ANALYZING: 45,
          LLM_ANALYZING: 80,
        }
        analysisProgress.value = Math.max(
          analysisProgress.value,
          progressByStatus[serverStatus] ?? Math.min(95, analysisProgress.value + 4),
        )
      }
    } catch {
      if (analysisStatus.value === 'processing') {
        analysisProgress.value = Math.min(95, analysisProgress.value + 4)
      }
    }
    return { status: analysisStatus.value, progress: analysisProgress.value }
  }

  const retryAnalysis = async () => {
    await analysisCompletePromise
    analysisStatus.value = 'idle'
    analysisProgress.value = 0
    analysisError.value = ''
    return beginAnalysis()
  }

  // 리포트 화면용: 방금 끝낸 세션은 complete 응답(report.value)을 그대로 쓰고,
  // 다른 세션에서 "내 기록"으로 재방문한 경우는 id로 서버 리포트를 조회한다.
  const loadReport = async (id) => {
    const targetId = id ?? interviewId.value
    const loadedReportId = report.value?.interviewId ?? interviewId.value
    const isSelectedReportLoaded = report.value
      && loadedReportId != null
      && String(loadedReportId) === String(targetId)
    if (!isSelectedReportLoaded && targetId) {
      const requestGeneration = ++reportRequestGeneration
      report.value = null
      const nextReport = unwrapApiResponse(await interviewApi.getReport(targetId))
      if (requestGeneration !== reportRequestGeneration) return report.value
      report.value = nextReport
      const numericTargetId = Number(targetId)
      interviewId.value = report.value?.interviewId
        ?? (Number.isFinite(numericTargetId) ? numericTargetId : targetId)
    }
    return report.value
  }

  const reset = () => {
    clearActiveRecording('interview')
    interviewId.value = null
    practiceId.value = null
    title.value = ''
    description.value = ''
    companyId.value = null
    company.value = ''
    occupationId.value = null
    field.value = ''
    jobId.value = null
    position.value = ''
    careerLevel.value = ''
    keywords.value = []
    resumeDocs.value = []
    portfolioDocs.value = []
    docsError.value = ''
    interviewerId.value = null
    interviewerStyle.value = 'practical'
    questions.value = []
    questionFeedbacks.value = {}
    createdSignature.value = ''
    preflightDone.value = false
    recordedSeconds.value = 0
    answers.value = []
    sessionAudioBlob.value = null
    sessionVideoBlob.value = null
    sessionVideoOwnerId.value = null
    sessionNonverbal.value = null
    analysisStatus.value = 'idle'
    analysisProgress.value = 0
    analysisError.value = ''
    reportJob.value = null
    reportRequestGeneration += 1
    report.value = null
    completeInterviewPromise = null
    analysisCompletePromise = null
    saveError.value = ''
    jobs.value = []
    sessionStorage.removeItem(FLOW_KEY)
  }

  return {
    interviewId, practiceId, title, description, companyId, company, occupationId, field, jobId, position,
    careerLevel, keywords, resumeDocs, portfolioDocs, interviewerId, interviewerStyle, questions, questionFeedbacks,
    preflightDone, setPreflightDone,
    recordedSeconds, answers, sessionAudioBlob, sessionVideoBlob, sessionVideoOwnerId, sessionNonverbal,
    analysisStatus, analysisProgress, analysisError, reportJob, report,
    companies, occupations, jobs, interviewers, catalogError,
    resumeCatalog, portfolioCatalog, docsSaving, docsError,
    saving, saveError, questionCount, estimatedMinutes,
    loadCompanies, loadOccupations, loadJobs, loadInterviewers,
    loadResumeCatalog, loadPortfolioCatalog, uploadResumeDoc, uploadPortfolioDoc,
    deleteResumeDoc, deletePortfolioDoc,
    setResumeSelection, setPortfolioSelection,
    setInfo, setInterviewer, setQuestions, setRecordedSeconds,
    createInterview, loadQuestions, loadQuestionFeedback, addQuestion, removeQuestion,
    finishRecording, analyzeAnswerAudio, completeInterview,
    beginAnalysis, pollAnalysis, retryAnalysis, loadReport, reset,
  }
})
