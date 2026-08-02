import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { practiceApi, presentationApi, unwrapApiResponse } from '../api/index.js'
import { normalizePresentationSlide } from '../api/normalizers/presentation.js'
import { parseServerId } from '../api/serverId.js'
import { SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { buildSlideVisitText } from '../utils/presentationArtifacts.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'
import { usePracticeStore } from './practiceStore.js'

const FLOW_KEY = SESSION_STORAGE_KEYS.presentationFlow
const DEFAULT_POLL_INTERVAL_MS = 2_000
const DEFAULT_MAX_POLL_ATTEMPTS = 90
const TERMINAL_FAILURE_STATUS = 'FAILED'
const READY_STATUS = 'COMPLETED'

const loadDraft = () => readJsonStorage(sessionStorage, FLOW_KEY, {}) || {}
const wait = (milliseconds) => (
  milliseconds > 0
    ? new Promise((resolve) => window.setTimeout(resolve, milliseconds))
    : Promise.resolve()
)

const sourceFileMetadata = (file) => file
  ? {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    }
  : null

const normalizeSlides = (response) => {
  const value = unwrapApiResponse(response)
  const slides = Array.isArray(value) ? value : value.slides
  return Array.isArray(slides) ? slides.map(normalizePresentationSlide) : []
}

export const usePresentationStore = defineStore('presentation', () => {
  const draft = loadDraft()
  const practice = usePracticeStore()

  // sessionId is retained as the public name used by existing views. It now
  // contains Spring's presentationId, not the removed presentation-session id.
  const sessionId = ref(parseServerId(draft.sessionId))
  const practiceId = ref(parseServerId(draft.practiceId))
  const sessionStatus = ref(draft.sessionStatus ?? 'draft')
  const title = ref(draft.title ?? '')
  const description = ref(draft.description ?? '')
  const targetMinutes = ref(draft.targetMinutes ?? 5)
  const qnaEnabled = ref(draft.qnaEnabled ?? false)
  const sourceFile = ref(draft.sourceFile ?? null)
  const stagedFile = ref(null)
  const uploadStatus = ref(draft.uploadStatus === 'ready' ? 'ready' : 'idle')
  const uploadError = ref(null)
  const slides = ref(Array.isArray(draft.slides) ? draft.slides.map(normalizePresentationSlide) : [])
  const currentSlideIndex = ref(draft.currentSlideIndex ?? 0)
  const recordedSeconds = ref(draft.recordedSeconds ?? 0)
  const slideTimeline = ref(Array.isArray(draft.slideTimeline) ? draft.slideTimeline : [])
  const transcriptEvents = ref(Array.isArray(draft.transcriptEvents) ? draft.transcriptEvents : [])
  const analysisSummary = ref(draft.analysisSummary ?? null)
  const audioAnalysisResults = ref([])
  const audioAnalysisState = ref({
    status: 'idle',
    sequence: null,
    error: null,
  })
  const recordingArtifacts = ref(null)
  const audienceQuestions = ref([])
  const report = ref(null)

  const slideCount = computed(() => slides.value.length)
  const hasUploadedSlides = computed(() => (
    uploadStatus.value === 'ready' && slides.value.length > 0
  ))
  const hasRenderableSlides = computed(() => (
    hasUploadedSlides.value && slides.value.every((slide) => Boolean(slide.previewUrl))
  ))
  const recordedDuration = computed(() => {
    const minutes = Math.floor(recordedSeconds.value / 60)
    const seconds = String(recordedSeconds.value % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  })

  watch(
    [
      sessionId,
      practiceId,
      sessionStatus,
      title,
      description,
      targetMinutes,
      qnaEnabled,
      sourceFile,
      uploadStatus,
      slides,
      currentSlideIndex,
      recordedSeconds,
      slideTimeline,
      transcriptEvents,
      analysisSummary,
    ],
    () => {
      writeJsonStorage(sessionStorage, FLOW_KEY, {
        sessionId: sessionId.value,
        practiceId: practiceId.value,
        sessionStatus: sessionStatus.value,
        title: title.value,
        description: description.value,
        targetMinutes: targetMinutes.value,
        qnaEnabled: qnaEnabled.value,
        sourceFile: sourceFile.value,
        uploadStatus: uploadStatus.value,
        slides: slides.value,
        currentSlideIndex: currentSlideIndex.value,
        recordedSeconds: recordedSeconds.value,
        slideTimeline: slideTimeline.value,
        transcriptEvents: transcriptEvents.value,
        analysisSummary: analysisSummary.value,
      })
    },
    { deep: true },
  )

  const setTitle = (value) => { title.value = String(value ?? '') }
  const setDescription = (value) => { description.value = String(value ?? '').slice(0, 50) }
  const setTargetMinutes = (value) => {
    targetMinutes.value = Math.max(1, Math.min(60, Number(value) || 1))
  }
  const setQnaEnabled = (value) => { qnaEnabled.value = Boolean(value) }
  // 폴더 기존 자료 재사용 시 새 파일 대신 자료 ID만 스테이징한다(백엔드 '기존
  // 자료로 연습 생성' 연결 지점 — 현재는 목). 새 파일 업로드와 상호 배타적.
  const stagedMaterialId = ref(null)
  const stagePresentationFile = (file) => {
    stagedFile.value = file ?? null
    stagedMaterialId.value = null
    sourceFile.value = sourceFileMetadata(file)
    uploadStatus.value = file ? 'staged' : 'idle'
  }
  const stageReusedMaterial = (materialId) => {
    stagedMaterialId.value = materialId ?? null
    stagedFile.value = null
    sourceFile.value = null
    uploadStatus.value = materialId ? 'staged' : 'idle'
  }
  const setSlides = (items) => {
    slides.value = items.map(normalizePresentationSlide)
    currentSlideIndex.value = 0
  }
  const setCurrentSlideIndex = (index) => {
    currentSlideIndex.value = Math.min(
      Math.max(Number(index) || 0, 0),
      Math.max(0, slides.value.length - 1),
    )
  }
  const setSlideKeyPoints = (slideId, keyPoints) => {
    const slide = slides.value.find((item) => String(item.id) === String(slideId))
    if (slide) slide.keyPoints = String(keyPoints ?? '')
  }
  const setRecordedSeconds = (seconds) => {
    recordedSeconds.value = Math.max(0, Math.round(Number(seconds) || 0))
  }

  const createRequest = () => {
    const folderId = parseServerId(practice.folderId)
    if (folderId === null) throw new Error('실제 연습 폴더를 먼저 선택해주세요.')
    if (!title.value.trim()) throw new Error('연습 이름을 입력해주세요.')
    if (!description.value.trim()) throw new Error('연습 설명을 입력해주세요.')
    if (title.value.trim().length > 128) throw new Error('연습 이름은 128자 이하여야 합니다.')
    if (description.value.trim().length > 50) throw new Error('연습 설명은 50자 이하여야 합니다.')

    return {
      folderId,
      title: title.value.trim(),
      description: description.value.trim(),
      targetDurationSec: Math.round(targetMinutes.value * 60),
      aiQnaEnabled: qnaEnabled.value,
    }
  }

  const loadSlides = async () => {
    if (!sessionId.value) return []
    const loaded = normalizeSlides(await presentationApi.getSlides(sessionId.value))
    if (!loaded.length) throw new Error('서버에서 변환된 슬라이드를 받지 못했습니다.')
    setSlides(loaded)
    uploadStatus.value = 'ready'
    sessionStatus.value = 'ready'
    return slides.value
  }

  const pollUntilReady = async ({
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
  } = {}) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = unwrapApiResponse(await presentationApi.getStatus(sessionId.value))
      const status = String(response.processingStatus ?? response.status ?? '').toUpperCase()
      sessionStatus.value = status.toLowerCase()
      if (status === READY_STATUS) return loadSlides()
      if (status === TERMINAL_FAILURE_STATUS) {
        throw new Error('발표 자료 변환에 실패했습니다. 파일을 확인한 뒤 다시 업로드해주세요.')
      }
      if (attempt < maxAttempts - 1) await wait(pollIntervalMs)
    }
    throw new Error('발표 자료 변환 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
  }

  const uploadPresentation = async (file = stagedFile.value, pollingOptions = {}) => {
    if (!file) throw new Error('발표 자료를 선택해주세요.')
    uploadStatus.value = 'processing'
    uploadError.value = null
    slides.value = []

    try {
      if (sessionId.value) {
        await presentationApi.reupload(sessionId.value, file)
      } else {
        const response = unwrapApiResponse(await presentationApi.create({
          request: createRequest(),
          file,
        }))
        sessionId.value = parseServerId(response.presentationId)
        practiceId.value = parseServerId(response.practiceId)
        if (sessionId.value === null || practiceId.value === null) {
          throw new Error('발표 생성 응답에 presentationId 또는 practiceId가 없습니다.')
        }
        sessionStatus.value = String(response.status ?? 'PENDING').toLowerCase()
      }

      stagedFile.value = file
      sourceFile.value = sourceFileMetadata(file)
      return await pollUntilReady(pollingOptions)
    } catch (error) {
      uploadStatus.value = 'error'
      uploadError.value = error?.message || '발표 자료 처리에 실패했습니다.'
      throw error
    }
  }

  const ensureSlidesLoaded = async () => {
    if (hasRenderableSlides.value) return slides.value
    return loadSlides()
  }

  // 폴더의 완료된 과거 발표(stagedMaterialId)를 그대로 복제해 새 발표를
  // 만든다. 응답 status가 PENDING으로 올 수 있어(실제 서버 예시 확인),
  // uploadPresentation과 동일하게 폴링해서 완료를 기다린다.
  const reusePresentation = async (pollingOptions = {}) => {
    const materialId = stagedMaterialId.value
    if (materialId == null) throw new Error('재사용할 자료를 선택해주세요.')
    uploadStatus.value = 'processing'
    uploadError.value = null
    slides.value = []

    try {
      const response = unwrapApiResponse(await presentationApi.reuse({
        ...createRequest(),
        sourcePresentationId: materialId,
      }))
      sessionId.value = parseServerId(response.presentationId)
      practiceId.value = parseServerId(response.practiceId)
      if (sessionId.value === null || practiceId.value === null) {
        throw new Error('발표 생성 응답에 presentationId 또는 practiceId가 없습니다.')
      }
      sessionStatus.value = String(response.status ?? 'PENDING').toLowerCase()
      return await pollUntilReady(pollingOptions)
    } catch (error) {
      uploadStatus.value = 'error'
      uploadError.value = error?.message || '기존 자료로 발표를 만들지 못했습니다.'
      throw error
    }
  }

  const clearPresentationFile = () => {
    stagedFile.value = null
    sourceFile.value = null
    uploadStatus.value = 'idle'
    uploadError.value = null
    slides.value = []
    currentSlideIndex.value = 0
  }

  // Spring has no presentation metadata PATCH endpoint. Settings are submitted
  // atomically with the source file in uploadPresentation().
  const syncSettings = async () => ({
    presentationId: sessionId.value,
    practiceId: practiceId.value,
  })

  const saveSlideNotes = async () => {
    if (!sessionId.value) throw new Error('발표 자료를 먼저 업로드해주세요.')
    const updates = slides.value.map((slide) => ({
      slideId: parseServerId(slide.id),
      description: String(slide.keyPoints ?? '').trim(),
    }))
    if (updates.some((slide) => slide.slideId === null || !slide.description)) {
      throw new Error('모든 슬라이드의 핵심 내용을 입력해주세요.')
    }
    await presentationApi.updateDescriptions(sessionId.value, updates)
    return slides.value
  }

  const startRecordingSession = async () => {
    if (!sessionId.value) throw new Error('발표 자료를 먼저 업로드해주세요.')
    const response = unwrapApiResponse(await presentationApi.start(sessionId.value))
    practiceId.value = parseServerId(response.practiceId) ?? practiceId.value
    const firstSlideId = parseServerId(response.firstSlideId) ?? parseServerId(slides.value[0]?.id)
    if (practiceId.value === null || firstSlideId === null) {
      throw new Error('발표 시작 응답에 practiceId 또는 첫 슬라이드 정보가 없습니다.')
    }

    slideTimeline.value = [{
      slideId: firstSlideId,
      slideIndex: 0,
      startedAtMs: 0,
      endedAtMs: null,
    }]
    transcriptEvents.value = []
    audioAnalysisResults.value = []
    audioAnalysisState.value = {
      status: 'idle',
      sequence: null,
      error: null,
    }
    recordingArtifacts.value = null
    sessionStatus.value = 'recording'
    return response
  }

  const recordSlideTransition = async (fromIndex, toIndex, elapsedSeconds) => {
    const occurredTimeMs = Math.max(1, Math.round(Number(elapsedSeconds) * 1_000))
    const currentVisit = slideTimeline.value.at(-1)
    if (currentVisit && currentVisit.endedAtMs == null) currentVisit.endedAtMs = occurredTimeMs

    const toSlideId = parseServerId(slides.value[toIndex]?.id)
    if (toSlideId === null) throw new Error('이동할 슬라이드 ID가 올바르지 않습니다.')
    slideTimeline.value.push({
      slideId: toSlideId,
      slideIndex: toIndex,
      previousSlideIndex: fromIndex,
      startedAtMs: occurredTimeMs,
      endedAtMs: null,
    })
    currentSlideIndex.value = toIndex

    await presentationApi.createSlideEvent(sessionId.value, {
      toSlideId,
      occurredTimeMs,
    })
  }

  const addTranscriptEvent = ({ text, slideIndex, atSeconds, atMs }) => {
    const content = String(text ?? '').trim()
    if (!content) return
    transcriptEvents.value.push({
      text: content,
      slideId: slides.value[slideIndex]?.id ?? null,
      slideIndex,
      atMs: Math.max(0, Math.round(atMs ?? Number(atSeconds) * 1_000)),
    })
  }

  const analyzeAudioChunk = async ({ blob, sequence }) => {
    if (practiceId.value === null) throw new Error('발표 practiceId가 없습니다.')
    audioAnalysisState.value = {
      status: 'sending',
      sequence,
      error: null,
    }
    try {
      const response = unwrapApiResponse(await practiceApi.analyzeAudio(practiceId.value, {
        blob,
        sequence,
        fileName: `presentation-${String(sequence).padStart(4, '0')}.wav`,
      }))
      audioAnalysisResults.value = [
        ...audioAnalysisResults.value.filter((item) => item.sequence !== response.sequence),
        response,
      ].sort((left, right) => left.sequence - right.sequence)
      audioAnalysisState.value = {
        status: 'success',
        sequence,
        error: null,
      }
      return response
    } catch (error) {
      audioAnalysisState.value = {
        status: 'error',
        sequence,
        error: {
          message: error?.message || 'Audio analysis failed.',
          status: error?.status ?? null,
          code: error?.code ?? null,
        },
      }
      throw error
    }
  }

  const setRecordingArtifacts = ({
    webmBlob,
    wavBlob,
    text,
    detects,
    durationMs,
    metrics = {},
  }) => {
    const safeDurationMs = Math.max(0, Math.round(durationMs))
    recordedSeconds.value = Math.round(safeDurationMs / 1_000)
    const lastVisit = slideTimeline.value.at(-1)
    if (lastVisit && lastVisit.endedAtMs == null) lastVisit.endedAtMs = safeDurationMs
    analysisSummary.value = { ...metrics }
    recordingArtifacts.value = {
      webm: webmBlob,
      wav: wavBlob,
      text: Array.isArray(text)
        ? text
        : buildSlideVisitText({
            slides: slides.value,
            visits: slideTimeline.value,
            transcripts: transcriptEvents.value,
          }),
      detects: Array.isArray(detects) ? detects : [],
      durationMs: safeDurationMs,
    }
    sessionStatus.value = 'review'
    return recordingArtifacts.value
  }

  const finishRecording = async ({
    blob,
    wavBlob = null,
    durationSeconds,
    metrics,
    text,
    detects,
  }) => setRecordingArtifacts({
    webmBlob: blob,
    wavBlob,
    text,
    detects,
    durationMs: Number(durationSeconds) * 1_000,
    metrics,
  })

  const completeSession = async ({ durationMs } = {}) => {
    if (!sessionId.value) throw new Error('발표 ID가 없습니다.')
    const requestedDuration = Math.max(
      1,
      Math.round(
        durationMs
        ?? recordingArtifacts.value?.durationMs
        ?? recordedSeconds.value * 1_000,
      ),
    )
    const lastEventTime = slideTimeline.value.at(-1)?.startedAtMs ?? 0
    const safeDuration = Math.max(requestedDuration, lastEventTime + 1)
    await presentationApi.complete(sessionId.value, safeDuration)
    sessionStatus.value = 'completed'
  }

  const generateAudienceQuestions = async () => {
    const visits = recordingArtifacts.value?.text
      ?? buildSlideVisitText({
        slides: slides.value,
        visits: slideTimeline.value,
        transcripts: transcriptEvents.value,
      })
    const request = visits.map(({ page, content }) => ({ page, content }))
    audienceQuestions.value = unwrapApiResponse(
      await presentationApi.generateQuestions(sessionId.value, request),
    )
    return audienceQuestions.value
  }

  const loadAudienceQuestions = async () => {
    audienceQuestions.value = unwrapApiResponse(
      await presentationApi.getQuestions(sessionId.value),
    )
    return audienceQuestions.value
  }

  // Spring currently has no presentation report endpoint. This object contains
  // only data measured or entered in this browser session.
  const loadReport = async () => {
    report.value = {
      presentationId: sessionId.value,
      practiceId: practiceId.value,
      title: title.value,
      description: description.value,
      durationSeconds: recordedSeconds.value,
      slides: slides.value,
      transcripts: transcriptEvents.value,
      text: recordingArtifacts.value?.text ?? [],
      detects: recordingArtifacts.value?.detects ?? [],
      audioAnalysisResults: audioAnalysisResults.value,
      metrics: analysisSummary.value,
    }
    return report.value
  }

  const reset = () => {
    sessionId.value = null
    practiceId.value = null
    sessionStatus.value = 'draft'
    title.value = ''
    description.value = ''
    targetMinutes.value = 5
    qnaEnabled.value = false
    sourceFile.value = null
    stagedFile.value = null
    stagedMaterialId.value = null
    uploadStatus.value = 'idle'
    uploadError.value = null
    slides.value = []
    currentSlideIndex.value = 0
    recordedSeconds.value = 0
    slideTimeline.value = []
    transcriptEvents.value = []
    analysisSummary.value = null
    audioAnalysisResults.value = []
    audioAnalysisState.value = {
      status: 'idle',
      sequence: null,
      error: null,
    }
    recordingArtifacts.value = null
    audienceQuestions.value = []
    report.value = null
    sessionStorage.removeItem(FLOW_KEY)
  }

  return {
    sessionId,
    practiceId,
    sessionStatus,
    title,
    description,
    targetMinutes,
    qnaEnabled,
    sourceFile,
    stagedFile,
    stagedMaterialId,
    uploadStatus,
    uploadError,
    slides,
    currentSlideIndex,
    recordedSeconds,
    slideTimeline,
    transcriptEvents,
    analysisSummary,
    audioAnalysisResults,
    audioAnalysisState,
    recordingArtifacts,
    audienceQuestions,
    report,
    slideCount,
    hasUploadedSlides,
    hasRenderableSlides,
    recordedDuration,
    setTitle,
    setDescription,
    setTargetMinutes,
    setQnaEnabled,
    stagePresentationFile,
    stageReusedMaterial,
    setSlides,
    setCurrentSlideIndex,
    setSlideKeyPoints,
    setRecordedSeconds,
    uploadPresentation,
    reusePresentation,
    ensureSlidesLoaded,
    clearPresentationFile,
    syncSettings,
    saveSlideNotes,
    startRecordingSession,
    recordSlideTransition,
    addTranscriptEvent,
    analyzeAudioChunk,
    setRecordingArtifacts,
    finishRecording,
    completeSession,
    generateAudienceQuestions,
    loadAudienceQuestions,
    loadReport,
    reset,
  }
})
