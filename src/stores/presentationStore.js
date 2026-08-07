import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { presentationApi, readApiValue, unwrapApiResponse } from '../api/index.js'
import {
  extractPresentationSlides,
  mergePresentationSlides,
  normalizePresentationSlide,
} from '../api/normalizers/presentation.js'
import { buildPresentationSessionPayload } from '../api/payloads/presentation.js'
import { withMock } from '../api/withMock.js'
import { SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { buildPresentationReportMock } from '../mocks/presentation.js'
import { createLocalId } from '../utils/id.js'
import { getFileExtension } from '../utils/presentationFiles.js'
import { renderPdfToSlides } from '../utils/pdfSlides.js'
import { renderPptxToSlides } from '../utils/pptxSlides.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'
import { usePracticeStore } from './practiceStore.js'

const FLOW_KEY = SESSION_STORAGE_KEYS.presentationFlow

const loadDraft = () => readJsonStorage(sessionStorage, FLOW_KEY, {}) || {}

const isEphemeralPreview = (url) => /^(data|blob):/.test(String(url ?? ''))
const revokeSlidePreviews = (items = []) => {
  const urls = new Set(items.flatMap((slide) => [slide.previewUrl, slide.thumbnailUrl]))
  urls.forEach((url) => {
    if (String(url ?? '').startsWith('blob:')) URL.revokeObjectURL(url)
  })
}

export const usePresentationStore = defineStore('presentation', () => {
  const draft = loadDraft()
  const practice = usePracticeStore()
  const restoredSlides = Array.isArray(draft.slides) ? draft.slides.map(normalizePresentationSlide) : []
  const canRestoreUpload = Boolean(draft.sourceFile)
    && restoredSlides.length > 0
    && restoredSlides.every((slide) => Boolean(slide.previewUrl) && !isEphemeralPreview(slide.previewUrl))

  const sessionId = ref(draft.sessionId ?? null)
  const sessionStatus = ref(draft.sessionStatus ?? 'draft')
  const title = ref(draft.title ?? '')
  const description = ref(draft.description ?? '')
  const targetMinutes = ref(draft.targetMinutes ?? 5)
  const qnaEnabled = ref(draft.qnaEnabled ?? false)
  const sourceFile = ref(canRestoreUpload ? draft.sourceFile : null)
  const uploadStatus = ref(canRestoreUpload ? (draft.uploadStatus ?? 'ready') : 'idle')
  const uploadError = ref(null)
  const slides = ref(canRestoreUpload ? restoredSlides : [])
  const currentSlideIndex = ref(draft.currentSlideIndex ?? 0)
  const recordedSeconds = ref(draft.recordedSeconds ?? 0)
  const slideTimeline = ref(draft.slideTimeline ?? [])
  const transcriptEvents = ref(draft.transcriptEvents ?? [])
  const analysisSummary = ref(draft.analysisSummary ?? null)
  const recordingId = ref(draft.recordingId ?? null)
  const report = ref(null)

  let ensureSessionPromise = null

  const slideCount = computed(() => slides.value.length)
  const hasUploadedSlides = computed(() => uploadStatus.value === 'ready' && Boolean(sourceFile.value) && slides.value.length > 0)
  const hasRenderableSlides = computed(() => hasUploadedSlides.value && slides.value.every((slide) => Boolean(slide.previewUrl)))
  const recordedDuration = computed(() => {
    const total = recordedSeconds.value
    const m = Math.floor(total / 60)
    const s = String(total % 60).padStart(2, '0')
    return `${m}:${s}`
  })

  watch(
    [sessionId, sessionStatus, title, description, targetMinutes, qnaEnabled, sourceFile, uploadStatus,
      slides, currentSlideIndex, recordedSeconds, slideTimeline, transcriptEvents, analysisSummary, recordingId],
    () => {
      const persistedSlides = slides.value.map((slide) => ({
        ...slide,
        previewUrl: isEphemeralPreview(slide.previewUrl) ? null : slide.previewUrl,
        thumbnailUrl: isEphemeralPreview(slide.thumbnailUrl) ? null : slide.thumbnailUrl,
      }))
      writeJsonStorage(sessionStorage, FLOW_KEY, {
        sessionId: sessionId.value,
        sessionStatus: sessionStatus.value,
        title: title.value,
        description: description.value,
        targetMinutes: targetMinutes.value,
        qnaEnabled: qnaEnabled.value,
        sourceFile: sourceFile.value,
        uploadStatus: uploadStatus.value,
        slides: persistedSlides,
        currentSlideIndex: currentSlideIndex.value,
        recordedSeconds: recordedSeconds.value,
        slideTimeline: slideTimeline.value,
        transcriptEvents: transcriptEvents.value,
        analysisSummary: analysisSummary.value,
        recordingId: recordingId.value,
      })
    },
    { deep: true },
  )

  const setTitle = (value) => { title.value = value }
  const setDescription = (value) => { description.value = value }
  const setTargetMinutes = (value) => {
    targetMinutes.value = Math.max(1, Math.min(60, Number(value) || 1))
  }
  const setQnaEnabled = (value) => { qnaEnabled.value = Boolean(value) }
  const setSlides = (nextSlides) => {
    slides.value = nextSlides.map(normalizePresentationSlide)
    currentSlideIndex.value = 0
  }
  const setCurrentSlideIndex = (index) => {
    const maxIndex = Math.max(0, slides.value.length - 1)
    currentSlideIndex.value = Math.min(Math.max(index, 0), maxIndex)
  }
  const setSlideKeyPoints = (slideId, keyPoints) => {
    const target = slides.value.find((slide) => slide.id === slideId)
    if (target) target.keyPoints = keyPoints
  }
  const setRecordedSeconds = (seconds) => {
    recordedSeconds.value = Math.max(0, Math.round(seconds))
  }

  const sessionPayload = (overrides = {}) => buildPresentationSessionPayload({
    folderId: practice.folderId,
    title: title.value,
    description: description.value,
    targetMinutes: targetMinutes.value,
    qnaEnabled: qnaEnabled.value,
  }, overrides)

  const ensureSession = async (overrides = {}) => {
    if (sessionId.value) return sessionId.value
    if (ensureSessionPromise) return ensureSessionPromise

    ensureSessionPromise = (async () => {
      const fallback = { sessionId: createLocalId('local-session'), status: 'DRAFT' }
      const response = await withMock(
        () => presentationApi.createSession(sessionPayload(overrides)),
        () => fallback,
      )
      sessionId.value = readApiValue(response, ['sessionId', 'id', 'presentationSessionId'], fallback.sessionId) || fallback.sessionId
      sessionStatus.value = String(unwrapApiResponse(response).status ?? 'draft').toLowerCase()
      return sessionId.value
    })().finally(() => { ensureSessionPromise = null })

    return ensureSessionPromise
  }

  const syncSettings = async () => {
    const id = await ensureSession()
    return withMock(
      () => presentationApi.updateSession(id, sessionPayload({ status: sessionStatus.value.toUpperCase() })),
      () => ({ sessionId: id, status: sessionStatus.value }),
    )
  }

  const uploadPresentation = async (file) => {
    revokeSlidePreviews(slides.value)
    slides.value = []
    sourceFile.value = null
    uploadStatus.value = 'processing'
    uploadError.value = null

    try {
      const id = await ensureSession()
      const extension = getFileExtension(file.name)
      const response = await withMock(
        () => presentationApi.uploadSlides(id, file),
        () => null,
      )
      const apiSlides = extractPresentationSlides(response)
      let renderedSlides = null

      // 서버에서 만든 미리보기가 가장 정확하다. 아직 변환 API가 없거나
      // 일부 이미지가 빠졌다면 실제 업로드 파일을 브라우저에서 렌더링한다.
      if (!apiSlides.length || apiSlides.some((slide) => !slide.previewUrl)) {
        try {
          renderedSlides = extension === 'pdf'
            ? await renderPdfToSlides(file)
            : await renderPptxToSlides(file)
        } catch (renderError) {
          if (import.meta.env?.DEV) console.warn('[AIVO] 로컬 슬라이드 렌더링 실패:', renderError)
          if (!apiSlides.length) throw renderError
        }
      }
      const nextSlides = mergePresentationSlides(apiSlides, renderedSlides)

      if (!nextSlides.length) {
        throw new Error('발표 자료에서 슬라이드 목록을 만들지 못했습니다.')
      }
      if (nextSlides.some((slide) => !slide.previewUrl)) {
        throw new Error('슬라이드 미리보기 변환이 완료되지 않았습니다. 파일을 다시 확인해 주세요.')
      }

      setSlides(nextSlides)
      sourceFile.value = { name: file.name, size: file.size, type: file.type || 'application/octet-stream' }
      uploadStatus.value = 'ready'
      sessionStatus.value = 'ready'
      await syncSettings()
      return slides.value
    } catch (error) {
      uploadStatus.value = 'error'
      uploadError.value = error?.message || '발표 자료 처리에 실패했습니다.'
      throw error
    }
  }

  const clearPresentationFile = () => {
    revokeSlidePreviews(slides.value)
    sourceFile.value = null
    uploadStatus.value = 'idle'
    uploadError.value = null
    slides.value = []
    currentSlideIndex.value = 0
  }

  const ensureSlidesLoaded = async () => {
    if (hasRenderableSlides.value || !sessionId.value) return slides.value
    const response = await withMock(
      () => presentationApi.getSession(sessionId.value),
      () => null,
    )
    const loaded = extractPresentationSlides(response)
    if (loaded.length) {
      const notesById = new Map(slides.value.map((slide) => [String(slide.id), slide.keyPoints]))
      setSlides(loaded.map((slide) => ({
        ...slide,
        keyPoints: slide.keyPoints || notesById.get(String(slide.id)) || '',
      })))
      uploadStatus.value = 'ready'
    }
    return slides.value
  }

  const saveSlideNotes = async () => {
    const id = await ensureSession()
    await Promise.all(slides.value.map((slide) => withMock(
      () => presentationApi.updateSlideNotes(id, slide.id, {
        keyPoints: slide.keyPoints,
        excluded: slide.excluded,
      }),
      () => ({ id: slide.id, keyPoints: slide.keyPoints, excluded: slide.excluded }),
    )))
    return slides.value
  }

  const startRecordingSession = async () => {
    const id = await ensureSession()
    slideTimeline.value = []
    transcriptEvents.value = []
    analysisSummary.value = null
    sessionStatus.value = 'recording'
    slideTimeline.value.push({
      slideId: slides.value[0]?.id ?? 1,
      slideIndex: 0,
      startedAtSeconds: 0,
      endedAtSeconds: null,
      durationSeconds: null,
    })
    await withMock(
      () => presentationApi.updateSession(id, sessionPayload({ status: 'RECORDING', startedAt: new Date().toISOString() })),
      () => ({ sessionId: id, status: 'RECORDING' }),
    )
    return id
  }

  const recordSlideTransition = async (fromIndex, toIndex, elapsedSeconds) => {
    const endedAtSeconds = Math.max(0, Math.round(elapsedSeconds))
    const currentEvent = slideTimeline.value.at(-1)
    if (currentEvent && currentEvent.endedAtSeconds == null) {
      currentEvent.endedAtSeconds = endedAtSeconds
      currentEvent.durationSeconds = Math.max(0, endedAtSeconds - currentEvent.startedAtSeconds)
    }

    const nextEvent = {
      slideId: slides.value[toIndex]?.id ?? toIndex + 1,
      slideIndex: toIndex,
      previousSlideIndex: fromIndex,
      startedAtSeconds: endedAtSeconds,
      endedAtSeconds: null,
      durationSeconds: null,
    }
    slideTimeline.value.push(nextEvent)
    currentSlideIndex.value = toIndex

    const id = await ensureSession()
    return withMock(
      () => presentationApi.recordSlideProgress(id, nextEvent),
      () => nextEvent,
    )
  }

  const addTranscriptEvent = ({ text, slideIndex, atSeconds }) => {
    if (!text?.trim()) return
    transcriptEvents.value.push({
      id: createLocalId('transcript'),
      text: text.trim(),
      slideId: slides.value[slideIndex]?.id ?? slideIndex + 1,
      slideIndex,
      atSeconds: Math.max(0, Math.round(atSeconds)),
    })
  }

  const finishRecording = async ({ blob, durationSeconds, metrics, complete = false }) => {
    setRecordedSeconds(durationSeconds)
    const lastEvent = slideTimeline.value.at(-1)
    if (lastEvent && lastEvent.endedAtSeconds == null) {
      lastEvent.endedAtSeconds = recordedSeconds.value
      lastEvent.durationSeconds = Math.max(0, recordedSeconds.value - lastEvent.startedAtSeconds)
    }
    analysisSummary.value = { ...metrics }

    const id = await ensureSession()
    const metadata = {
      durationSeconds: recordedSeconds.value,
      slides: slideTimeline.value,
      transcripts: transcriptEvents.value,
      metrics: analysisSummary.value,
    }
    const fallbackRecordingId = createLocalId('local-recording')
    const response = await withMock(
      () => presentationApi.submitRecording(id, { blob, metadata }),
      () => ({ recordingId: fallbackRecordingId }),
    )
    recordingId.value = readApiValue(response, ['recordingId', 'id'], fallbackRecordingId)
    sessionStatus.value = complete ? 'completed' : 'qna_pending'

    if (complete) await completeSession()
    else await withMock(
      () => presentationApi.updateSession(id, { status: 'QNA_PENDING', recordingId: recordingId.value }),
      () => ({ sessionId: id, status: 'QNA_PENDING' }),
    )

    return { recordingId: recordingId.value, metadata }
  }

  const completeSession = async ({ qnaAnswers = [] } = {}) => {
    const id = await ensureSession()
    const payload = {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      recordingId: recordingId.value,
      durationSeconds: recordedSeconds.value,
      slideTimeline: slideTimeline.value,
      transcripts: transcriptEvents.value,
      metrics: analysisSummary.value,
      qnaAnswers,
    }
    const response = await withMock(
      () => presentationApi.completeSession(id, payload),
      () => ({ sessionId: id, status: 'COMPLETED' }),
    )
    sessionStatus.value = 'completed'
    return response
  }

  const loadReport = async () => {
    const response = await withMock(
      () => presentationApi.getReport(sessionId.value),
      () => buildPresentationReportMock(recordedSeconds.value || 258, analysisSummary.value || {}, {
        slides: slides.value,
        transcripts: transcriptEvents.value,
      }),
    )
    const value = unwrapApiResponse(response)
    report.value = {
      ...value,
      slides: Array.isArray(value.slides) && value.slides.length ? value.slides.map(normalizePresentationSlide) : slides.value,
      transcripts: Array.isArray(value.transcripts) && value.transcripts.length ? value.transcripts : transcriptEvents.value,
    }
    return report.value
  }

  const reset = () => {
    revokeSlidePreviews(slides.value)
    sessionId.value = null
    sessionStatus.value = 'draft'
    title.value = ''
    description.value = ''
    targetMinutes.value = 5
    qnaEnabled.value = false
    sourceFile.value = null
    uploadStatus.value = 'idle'
    uploadError.value = null
    slides.value = []
    currentSlideIndex.value = 0
    recordedSeconds.value = 0
    slideTimeline.value = []
    transcriptEvents.value = []
    analysisSummary.value = null
    recordingId.value = null
    report.value = null
    sessionStorage.removeItem(FLOW_KEY)
  }

  return {
    sessionId,
    sessionStatus,
    title,
    description,
    targetMinutes,
    qnaEnabled,
    sourceFile,
    uploadStatus,
    uploadError,
    slides,
    currentSlideIndex,
    recordedSeconds,
    slideTimeline,
    transcriptEvents,
    analysisSummary,
    recordingId,
    report,
    slideCount,
    hasUploadedSlides,
    hasRenderableSlides,
    recordedDuration,
    setTitle,
    setDescription,
    setTargetMinutes,
    setQnaEnabled,
    setSlides,
    setCurrentSlideIndex,
    setSlideKeyPoints,
    setRecordedSeconds,
    ensureSession,
    syncSettings,
    uploadPresentation,
    ensureSlidesLoaded,
    clearPresentationFile,
    saveSlideNotes,
    startRecordingSession,
    recordSlideTransition,
    addTranscriptEvent,
    finishRecording,
    completeSession,
    loadReport,
    reset,
  }
})
