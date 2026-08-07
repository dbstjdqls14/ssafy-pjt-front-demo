import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { INPUT_LIMITS } from '../constants/inputLimits.js'

import { practiceApi, presentationApi, readApiCollection, unwrapApiResponse } from '../api/index.js'
import { normalizePresentationSlide } from '../api/normalizers/presentation.js'
import { normalizePresentationPractice } from '../api/normalizers/practice.js'
import { normalizePresentationReport } from '../api/normalizers/presentationReport.js'
import { parseServerId } from '../api/serverId.js'
import { SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { buildSlideVisitText } from '../utils/presentationArtifacts.js'
import { clearActiveRecording } from '../utils/recordingRefreshRecovery.js'
import { assertCompleteMedia } from '../utils/recordingValidation.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'
import { TEXT_INPUT_POLICIES, textPolicyValidationMessage } from '../utils/textInputPolicy.js'
import { practiceTitleValidationMessage } from '../utils/validators.js'
import { usePracticeStore } from './practiceStore.js'

const clampTargetMinutes = (value) => Math.max(
  INPUT_LIMITS.PRESENTATION_TARGET_MINUTES_MIN,
  Math.min(INPUT_LIMITS.PRESENTATION_TARGET_MINUTES_MAX, Number(value) || INPUT_LIMITS.PRESENTATION_TARGET_MINUTES_MIN),
)

const FLOW_KEY = SESSION_STORAGE_KEYS.presentationFlow
const DEFAULT_POLL_INTERVAL_MS = 2_000
const DEFAULT_MAX_POLL_ATTEMPTS = 90
const TERMINAL_FAILURE_STATUS = 'FAILED'
const READY_STATUS = 'COMPLETED'

const emptyNonverbal = () => ({
  gazeDeviationCount: 0,
  postureTiltPercent: 0,
  sampleCount: 0,
  gazeEvents: [],
  tiltBuckets: [],
})

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
  const targetMinutes = ref(clampTargetMinutes(draft.targetMinutes ?? 5))
  const qnaEnabled = ref(draft.qnaEnabled ?? false)
  const sourceFile = ref(draft.sourceFile ?? null)
  const stagedFile = ref(null)
  const uploadStatus = ref(draft.uploadStatus === 'ready' ? 'ready' : 'idle')
  const uploadError = ref(null)
  // 같은 폴더의 이전 발표 자료를 재사용하는 경로(파일 업로드 대신 슬라이드 복사).
  const reusableMaterials = ref([])
  const reusableMaterialsLoading = ref(false)
  const reusableMaterialsError = ref(null)
  const reusedSource = ref(draft.reusedSource ?? null)
  // 지금 만들어져 있는 발표가 어느 자료를 복사해 만든 것인지. 설정 화면을 되돌아와
  // 다른 자료로 바꿨을 때 새로 복사해야 하는지 판단하는 데 쓴다.
  const appliedReuseId = ref(draft.appliedReuseId ?? null)
  // A create/reuse request always creates a new presentation row. Keep every
  // presentation created during this setup flow out of the "existing deck"
  // picker, including rows that are no longer the current presentation after
  // the user goes back and changes the source.
  const flowPresentationIds = ref(
    Array.isArray(draft.flowPresentationIds)
      ? draft.flowPresentationIds.map(parseServerId).filter((id) => id !== null)
      : [],
  )
  const slides = ref(Array.isArray(draft.slides) ? draft.slides.map(normalizePresentationSlide) : [])
  const currentSlideIndex = ref(draft.currentSlideIndex ?? 0)
  // 장치 확인 + 슬라이드 확인을 한 번 끝냈는지. '다시 작성하러 가기'로 되돌아왔을 때
  // 같은 확인을 처음부터 다시 하게 만들지 않으려고 세션에 남긴다.
  const preflightDone = ref(draft.preflightDone === true)
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
  let reportRequestGeneration = 0
  let slideEventQueue = Promise.resolve()
  let slideEventFailure = null
  let completeSessionPromise = null

  const resetSlideEventQueue = () => {
    slideEventQueue = Promise.resolve()
    slideEventFailure = null
  }

  const waitForSlideEvents = async () => {
    await slideEventQueue
    if (slideEventFailure) throw slideEventFailure
  }

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
      reusedSource,
      appliedReuseId,
      flowPresentationIds,
      slides,
      currentSlideIndex,
      preflightDone,
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
        reusedSource: reusedSource.value,
        appliedReuseId: appliedReuseId.value,
        flowPresentationIds: flowPresentationIds.value,
        slides: slides.value,
        currentSlideIndex: currentSlideIndex.value,
        preflightDone: preflightDone.value,
        recordedSeconds: recordedSeconds.value,
        slideTimeline: slideTimeline.value,
        transcriptEvents: transcriptEvents.value,
        analysisSummary: analysisSummary.value,
      })
    },
    { deep: true },
  )

  const setTitle = (value) => { title.value = String(value ?? '') }
  const setDescription = (value) => { description.value = String(value ?? '') }
  const setTargetMinutes = (value) => {
    targetMinutes.value = clampTargetMinutes(value)
  }
  const setQnaEnabled = (value) => { qnaEnabled.value = Boolean(value) }
  const setPreflightDone = (value = true) => { preflightDone.value = Boolean(value) }
  const rememberFlowPresentationId = (value) => {
    const id = parseServerId(value)
    if (id === null || flowPresentationIds.value.includes(id)) return
    flowPresentationIds.value = [...flowPresentationIds.value, id]
  }
  const stagePresentationFile = (file) => {
    stagedFile.value = file ?? null
    sourceFile.value = sourceFileMetadata(file)
    uploadStatus.value = file ? 'staged' : 'idle'
    // 파일을 새로 고르면 '이전 자료 재사용' 선택은 취소된다(둘 중 하나만 쓴다).
    if (file) {
      reusedSource.value = null
      appliedReuseId.value = null
    }
  }

  // 고른 자료가 지금 발표를 만든 자료와 같은지. 다르면 goNext에서 새로 복사해야 한다.
  const needsReuse = computed(() => Boolean(
    reusedSource.value && reusedSource.value.presentationId !== appliedReuseId.value,
  ))

  // 이전 발표 자료를 재사용 대상으로 지정. 업로드 대기 중인 파일은 함께 비운다.
  const selectReusableMaterial = (material) => {
    if (!material) {
      reusedSource.value = null
      if (uploadStatus.value === 'staged') uploadStatus.value = 'idle'
      return null
    }
    reusedSource.value = {
      presentationId: material.presentationId,
      title: material.title,
      date: material.date,
    }
    stagedFile.value = null
    sourceFile.value = null
    uploadStatus.value = 'staged'
    return reusedSource.value
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
    const titleValidationError = practiceTitleValidationMessage(title.value)
    if (titleValidationError) throw new Error(titleValidationError)
    if (!description.value.trim()) throw new Error('연습 설명을 입력해주세요.')
    const descriptionValidationError = textPolicyValidationMessage(description.value, {
      policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
      maxLength: INPUT_LIMITS.PRACTICE_DESCRIPTION,
    })
    if (descriptionValidationError) throw new Error(descriptionValidationError)

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
    // 자료를 새로 올리거나 다른 자료로 만들면 장치·슬라이드 확인도 처음부터 다시 한다.
    preflightDone.value = false
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
        rememberFlowPresentationId(sessionId.value)
        sessionStatus.value = String(response.status ?? 'PENDING').toLowerCase()
      }

      stagedFile.value = file
      sourceFile.value = sourceFileMetadata(file)
      appliedReuseId.value = null
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

  // 같은 폴더에서 이전에 올린 발표 자료 후보 목록. 새 연습을 만들 때 파일을 다시
  // 올리지 않고 고를 수 있게 한다.
  const loadReusableMaterials = async () => {
    const folderId = parseServerId(practice.folderId)
    if (folderId === null) {
      reusableMaterials.value = []
      return []
    }
    reusableMaterialsLoading.value = true
    reusableMaterialsError.value = null
    try {
      const response = await practiceApi.listPresentationPractices(folderId)
      const currentPresentationId = parseServerId(sessionId.value)
      const excludedPresentationIds = new Set(flowPresentationIds.value)
      if (currentPresentationId !== null) excludedPresentationIds.add(currentPresentationId)
      const seenPresentationIds = new Set()
      reusableMaterials.value = readApiCollection(response, ['practices', 'items', 'content'])
        .map(normalizePresentationPractice)
        // 슬라이드를 복사할 수 있는 건 presentationId가 있는 연습뿐이다.
        .filter((item) => {
          const candidateId = parseServerId(item.presentationId)
          if (candidateId === null || excludedPresentationIds.has(candidateId) || seenPresentationIds.has(candidateId)) {
            return false
          }
          seenPresentationIds.add(candidateId)
          return true
        })
        .reverse() // 서버는 오래된 순으로 준다 → 최근 자료를 위로.
      return reusableMaterials.value
    } catch (error) {
      reusableMaterials.value = []
      reusableMaterialsError.value = error?.message || '이전 발표 자료를 불러오지 못했습니다.'
      throw error
    } finally {
      reusableMaterialsLoading.value = false
    }
  }

  // 이전 발표의 슬라이드를 복사해 새 발표를 만든다. 서버가 슬라이드까지 복사한 뒤
  // 완료 상태로 돌려주므로 변환 폴링 없이 바로 슬라이드를 읽어올 수 있다.
  const reusePresentation = async (sourcePresentationId = reusedSource.value?.presentationId) => {
    const sourceId = parseServerId(sourcePresentationId)
    if (sourceId === null) throw new Error('재사용할 발표 자료를 선택해주세요.')

    // Going back to setup must not create another presentation from the same
    // source when the already-created copy and its slides are still available.
    if (sourceId === parseServerId(appliedReuseId.value)) {
      if (hasRenderableSlides.value) return slides.value
      return loadSlides()
    }

    // 자료를 새로 올리거나 다른 자료로 만들면 장치·슬라이드 확인도 처음부터 다시 한다.
    preflightDone.value = false
    uploadStatus.value = 'processing'
    uploadError.value = null
    slides.value = []
    try {
      const response = unwrapApiResponse(await presentationApi.reuse({
        ...createRequest(),
        sourcePresentationId: sourceId,
      }))
      sessionId.value = parseServerId(response.presentationId)
      practiceId.value = parseServerId(response.practiceId)
      if (sessionId.value === null || practiceId.value === null) {
        throw new Error('발표 생성 응답에 presentationId 또는 practiceId가 없습니다.')
      }
      rememberFlowPresentationId(sessionId.value)
      sessionStatus.value = String(response.status ?? 'COMPLETED').toLowerCase()
      stagedFile.value = null
      appliedReuseId.value = sourceId
      return await loadSlides()
    } catch (error) {
      uploadStatus.value = 'error'
      uploadError.value = error?.message || '이전 발표 자료를 재사용하지 못했습니다.'
      throw error
    }
  }

  const clearPresentationFile = () => {
    stagedFile.value = null
    sourceFile.value = null
    reusedSource.value = null
    appliedReuseId.value = null
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
    const invalidSlide = slides.value.find((slide) => textPolicyValidationMessage(slide.keyPoints, {
      policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
      maxLength: INPUT_LIMITS.SLIDE_NOTE,
    }))
    if (invalidSlide) {
      throw new Error(textPolicyValidationMessage(invalidSlide.keyPoints, {
        policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
        maxLength: INPUT_LIMITS.SLIDE_NOTE,
      }))
    }
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

    resetSlideEventQueue()

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

  const recordSlideTransition = (fromIndex, toIndex, elapsedSeconds) => {
    const occurredTimeMs = Math.max(1, Math.round(Number(elapsedSeconds) * 1_000))
    const toSlideId = parseServerId(slides.value[toIndex]?.id)
    if (toSlideId === null) throw new Error('이동할 슬라이드 ID가 올바르지 않습니다.')

    const request = { toSlideId, occurredTimeMs }
    const queuedRequest = slideEventQueue.then(async () => {
      if (slideEventFailure) throw slideEventFailure
      try {
        const response = await presentationApi.createSlideEvent(sessionId.value, request)
        const currentVisit = slideTimeline.value.at(-1)
        if (currentVisit && currentVisit.endedAtMs == null) currentVisit.endedAtMs = occurredTimeMs
        slideTimeline.value.push({
          slideId: toSlideId,
          slideIndex: toIndex,
          previousSlideIndex: fromIndex,
          startedAtMs: occurredTimeMs,
          endedAtMs: null,
        })
        currentSlideIndex.value = toIndex
        return response
      } catch (error) {
        slideEventFailure = error
        throw error
      }
    })
    slideEventQueue = queuedRequest.catch(() => undefined)
    return queuedRequest
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
    nonverbal,
    durationMs,
    metrics = {},
  }) => {
    const safeDurationMs = Math.max(0, Math.round(durationMs))
    recordedSeconds.value = Math.round(safeDurationMs / 1_000)
    const lastVisit = slideTimeline.value.at(-1)
    if (lastVisit && lastVisit.endedAtMs == null) lastVisit.endedAtMs = safeDurationMs
    analysisSummary.value = { ...metrics }
    const resolvedText = Array.isArray(text)
      ? text
      : buildSlideVisitText({
          slides: slides.value,
          visits: slideTimeline.value,
          transcripts: transcriptEvents.value,
        })
    recordingArtifacts.value = {
      webm: webmBlob,
      wav: wavBlob,
      text: resolvedText
        .filter((item) => String(item?.content ?? '').trim())
        .map((item) => ({
          page: Number(item.page),
          timestamp: Math.max(0, Math.round(Number(item.timestamp) || 0)),
          content: String(item.content).trim(),
        })),
      nonverbal: nonverbal ?? emptyNonverbal(),
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
    nonverbal,
  }) => setRecordingArtifacts({
    webmBlob: blob,
    wavBlob,
    text,
    nonverbal,
    durationMs: Number(durationSeconds) * 1_000,
    metrics,
  })

  const completeSession = async ({ durationMs } = {}) => {
    if (sessionStatus.value === 'completed') return
    if (completeSessionPromise) return completeSessionPromise

    completeSessionPromise = (async () => {
      if (!sessionId.value) throw new Error('발표 ID가 없습니다.')
      assertCompleteMedia({
        durationSeconds: Number(recordingArtifacts.value?.durationMs) / 1_000,
        audioBlob: recordingArtifacts.value?.wav,
        videoBlob: recordingArtifacts.value?.webm,
      })
      await waitForSlideEvents()
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
      await presentationApi.complete(sessionId.value, {
        request: {
          durationMs: safeDuration,
          text: recordingArtifacts.value.text,
          nonverbal: recordingArtifacts.value.nonverbal,
        },
        audio: recordingArtifacts.value.wav,
        video: recordingArtifacts.value.webm,
      })
      sessionStatus.value = 'completed'
    })()

    try {
      await completeSessionPromise
    } finally {
      completeSessionPromise = null
    }
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

  const submitAudienceAnswer = async (questionId, answer) => {
    const targetId = parseServerId(questionId)
    if (targetId === null) throw new Error('질문 ID가 올바르지 않습니다.')
    return presentationApi.saveQuestionAnswer(targetId, String(answer ?? ''))
  }

  const loadReport = async (presentationId = sessionId.value) => {
    const targetId = parseServerId(presentationId)
    if (targetId === null) {
      const error = new Error('발표 리포트를 조회할 발표 ID가 없습니다.')
      error.code = 'INVALID_SERVER_ID'
      throw error
    }

    const requestGeneration = ++reportRequestGeneration
    report.value = null
    const nextReport = normalizePresentationReport(
      unwrapApiResponse(await presentationApi.getReport(targetId)),
    )
    if (requestGeneration !== reportRequestGeneration) return report.value
    report.value = nextReport
    return report.value
  }

  const loadReportJobStatus = async (presentationId = sessionId.value) => {
    const targetId = parseServerId(presentationId)
    if (targetId === null) throw new Error('발표 리포트 상태를 조회할 presentationId가 없습니다.')
    return unwrapApiResponse(await presentationApi.getReportJobStatus(targetId))
  }

  const loadProcessingStatus = async (presentationId = sessionId.value) => {
    const targetId = parseServerId(presentationId)
    if (targetId === null) {
      throw new Error('발표 처리 상태를 조회할 presentationId가 없습니다.')
    }
    return unwrapApiResponse(await presentationApi.getStatus(targetId))
  }

  const reset = () => {
    clearActiveRecording('presentation')
    resetSlideEventQueue()
    sessionId.value = null
    practiceId.value = null
    sessionStatus.value = 'draft'
    title.value = ''
    description.value = ''
    targetMinutes.value = 5
    qnaEnabled.value = false
    sourceFile.value = null
    stagedFile.value = null
    uploadStatus.value = 'idle'
    uploadError.value = null
    reusableMaterials.value = []
    reusableMaterialsLoading.value = false
    reusableMaterialsError.value = null
    reusedSource.value = null
    appliedReuseId.value = null
    flowPresentationIds.value = []
    slides.value = []
    currentSlideIndex.value = 0
    preflightDone.value = false
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
    completeSessionPromise = null
    audienceQuestions.value = []
    reportRequestGeneration += 1
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
    uploadStatus,
    uploadError,
    reusableMaterials,
    reusableMaterialsLoading,
    reusableMaterialsError,
    reusedSource,
    needsReuse,
    slides,
    currentSlideIndex,
    preflightDone,
    setPreflightDone,
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
    selectReusableMaterial,
    loadReusableMaterials,
    reusePresentation,
    setSlides,
    setCurrentSlideIndex,
    setSlideKeyPoints,
    setRecordedSeconds,
    uploadPresentation,
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
    submitAudienceAnswer,
    loadReport,
    loadReportJobStatus,
    loadProcessingStatus,
    reset,
  }
})
