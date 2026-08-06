import { unwrapApiResponse } from '../response.js'

const finiteNumber = (value, fallback = null) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const secondsFrom = (milliseconds, seconds, fallback = 0) => {
  if (milliseconds != null) return finiteNumber(milliseconds, fallback * 1_000) / 1_000
  return finiteNumber(seconds, fallback)
}

const clipInterval = (absoluteStartSec, absoluteEndSec, slideStartSec, slideEndSec) => {
  const start = Math.max(absoluteStartSec, slideStartSec)
  const end = Math.min(absoluteEndSec, slideEndSec)
  return end > start
    ? { startSec: start - slideStartSec, endSec: end - slideStartSec }
    : null
}

const normalizeSegments = (segments = []) => segments.map((segment, index) => {
  const isTimestamped = segment.startTimeMs != null || segment.timestampSt != null
  return {
    segmentId: segment.segmentId ?? index + 1,
    slideId: segment.slideId ?? null,
    text: String(segment.text ?? ''),
    absoluteStartSec: secondsFrom(segment.startTimeMs, segment.timestampSt),
    absoluteEndSec: secondsFrom(segment.endTimeMs, segment.timestampEnd),
    isTimestamped,
  }
})

const normalizeFillerBreakdown = (breakdown = []) => breakdown.flatMap((item) => {
  const word = String(Array.isArray(item) ? item[0] : item?.word ?? '').trim()
  const count = finiteNumber(Array.isArray(item) ? item[1] : item?.count, 0)
  return word && count > 0 ? [{ word, count }] : []
})

const normalizeFillerEvents = (events = []) => events.flatMap((event) => {
  const word = String(event?.word ?? '').trim()
  const absoluteAtSec = finiteNumber(event?.atSec)
  return word && absoluteAtSec !== null
    ? [{ word, atSec: absoluteAtSec, absoluteAtSec }]
    : []
})

const normalizeWindows = (windows = []) => windows
  .map((window, index) => ({
    ...window,
    logId: window.logId ?? null,
    sequence: finiteNumber(window.sequence, index),
    absoluteStartSec: secondsFrom(window.startTimeMs, window.startTimeSec),
    absoluteEndSec: secondsFrom(window.endTimeMs, window.endTimeSec),
    averageWpm: finiteNumber(window.averageWpm, 0),
    fillerCount: finiteNumber(window.fillerCount, 0),
    fillerEvents: normalizeFillerEvents(window.fillerEvents),
    silenceDetected: Boolean(window.silenceDetected),
    silenceDurationMs: finiteNumber(window.silenceDurationMs, 0),
    stutterDetected: Boolean(window.stutterDetected),
    feedback: String(window.feedback ?? ''),
  }))
  .filter((window) => window.absoluteEndSec > window.absoluteStartSec)
  .sort((left, right) => left.absoluteStartSec - right.absoluteStartSec)

const projectSpeech = (windows, slideStartSec, slideEndSec) => {
  const buckets = windows.flatMap((window) => {
    const clipped = clipInterval(
      window.absoluteStartSec,
      window.absoluteEndSec,
      slideStartSec,
      slideEndSec,
    )
    const ownsWindow = window.absoluteStartSec >= slideStartSec
      && window.absoluteStartSec < slideEndSec
    return clipped ? [{
      logId: window.logId,
      sequence: window.sequence,
      ...clipped,
      averageWpm: window.averageWpm,
      fillerCount: ownsWindow ? window.fillerCount : 0,
      // 그래프는 슬라이드 로컬 초를 x축으로 쓰므로 추임새 시각도 버킷·시선 이탈과
      // 같이 슬라이드 시작점 기준으로 옮긴다(원래 값은 absoluteAtSec에 남는다).
      fillerEvents: ownsWindow
        ? window.fillerEvents.map((event) => ({
            ...event,
            atSec: event.absoluteAtSec - slideStartSec,
          }))
        : [],
      silenceDetected: ownsWindow ? window.silenceDetected : false,
      silenceDurationMs: ownsWindow ? window.silenceDurationMs : 0,
      stutterDetected: ownsWindow ? window.stutterDetected : false,
      feedback: ownsWindow ? window.feedback : '',
    }] : []
  })
  if (!buckets.length) return null

  const measuredDuration = buckets.reduce(
    (total, bucket) => total + (bucket.endSec - bucket.startSec),
    0,
  )
  const averageWpm = measuredDuration
    ? buckets.reduce(
        (total, bucket) => total + bucket.averageWpm * (bucket.endSec - bucket.startSec),
        0,
      ) / measuredDuration
    : 0
  const slowestWindow = buckets.reduce((slowest, bucket) => (
    !slowest || bucket.averageWpm < slowest.averageWpm ? bucket : slowest
  ), null)
  const fastestWindow = buckets.reduce((fastest, bucket) => (
    !fastest || bucket.averageWpm > fastest.averageWpm ? bucket : fastest
  ), null)
  const fillerCounts = new Map()
  buckets.forEach((bucket) => {
    bucket.fillerEvents.forEach(({ word }) => {
      fillerCounts.set(word, (fillerCounts.get(word) ?? 0) + 1)
    })
  })

  return {
    averageWpm,
    totalFillerCount: buckets.reduce((total, bucket) => total + bucket.fillerCount, 0),
    fillerBreakdown: [...fillerCounts].map(([word, count]) => ({ word, count })),
    silenceDetectedWindowCount: buckets.filter((bucket) => bucket.silenceDetected).length,
    totalSilenceDurationMs: buckets.reduce(
      (total, bucket) => total + bucket.silenceDurationMs,
      0,
    ),
    stutterDetectedWindowCount: buckets.filter((bucket) => bucket.stutterDetected).length,
    slowestWindow,
    fastestWindow,
    buckets,
  }
}

const projectTranscripts = (segments, slide, slideStartSec, slideEndSec) => segments
  .filter((segment) => String(segment.slideId) === String(slide.slideId))
  .flatMap((segment) => {
    const clipped = clipInterval(
      segment.absoluteStartSec,
      segment.absoluteEndSec,
      slideStartSec,
      slideEndSec,
    )
    return clipped ? [{
      segmentId: segment.segmentId,
      slideId: segment.slideId,
      text: segment.text,
      ...clipped,
      absoluteStartSec: segment.absoluteStartSec,
      absoluteEndSec: segment.absoluteEndSec,
      isTimestamped: segment.isTimestamped,
    }] : []
  })
  .sort((left, right) => left.startSec - right.startSec)

const projectGesture = (gestureSeries, slideStartSec, slideEndSec) => {
  if (!gestureSeries) return null

  const buckets = (gestureSeries.buckets ?? []).flatMap((bucket) => {
    const clipped = clipInterval(
      finiteNumber(bucket.startSec, 0),
      finiteNumber(bucket.endSec, 0),
      slideStartSec,
      slideEndSec,
    )
    return clipped ? [{
      ...clipped,
      tiltPercent: finiteNumber(bucket.tiltPercent ?? bucket.tiltPct, 0),
    }] : []
  })
  const gazeEvents = (gestureSeries.gazeEvents ?? []).flatMap((event) => {
    const absoluteSec = finiteNumber(event.atSec, -1)
    return absoluteSec >= slideStartSec && absoluteSec < slideEndSec
      ? [{ atSec: absoluteSec - slideStartSec }]
      : []
  })

  return {
    buckets,
    gazeCount: gazeEvents.length,
    gazeEvents,
  }
}

const normalizeFeedback = (feedback) => feedback ? {
  feedbackId: feedback.feedbackId ?? null,
  totalFeedbackId: feedback.totalFeedbackId ?? null,
  score: finiteNumber(feedback.score),
  content: String(feedback.content ?? ''),
} : null

export const normalizePresentationReport = (response) => {
  const value = unwrapApiResponse(response) ?? {}
  const practice = value.practice ?? {}
  const presentation = value.presentation ?? {}
  const score = value.score ?? {}
  const durationSec = finiteNumber(practice.durationSec)
    ?? finiteNumber(practice.durationMs, 0) / 1_000
  const segments = normalizeSegments(value.audioStt?.segments)
  const windows = normalizeWindows(value.speechAnalysis?.windows)
  const fillerBreakdown = normalizeFillerBreakdown(value.speechAnalysis?.fillerBreakdown)
  const gestureSeries = value.nonverbalAnalysis?.gestureSeries
    ?? value.gestureSeries
    ?? null
  const sortedSlides = [...(value.slides ?? [])]
    .sort((left, right) => finiteNumber(left.slideNumber, 0) - finiteNumber(right.slideNumber, 0))
  const questionAnswers = (value.questionAnswers ?? []).map((item) => ({
    questionId: item.questionId ?? null,
    question: String(item.question ?? ''),
    modelAnswer: String(item.modelAnswer ?? ''),
    userAnswer: String(item.userAnswer ?? ''),
    feedback: normalizeFeedback(item.feedback),
  }))
  const providedQuestionAnswerScore = score.questionAnswerScore == null
    ? null
    : finiteNumber(score.questionAnswerScore)
  const questionFeedbackScores = questionAnswers
    .map((item) => item.feedback?.score)
    .filter((itemScore) => Number.isFinite(itemScore))
  const calculatedQuestionAnswerScore = questionFeedbackScores.length
    ? Math.round(
        (questionFeedbackScores.reduce((sum, itemScore) => sum + itemScore, 0)
          / questionFeedbackScores.length) * 10,
      ) / 10
    : null

  const slides = sortedSlides.map((slide, index) => {
    const startTimeSec = secondsFrom(slide.startTimeMs, slide.startTimeSec, 0)
    const nextSlide = sortedSlides[index + 1]
    const nextStartSec = nextSlide
      ? secondsFrom(nextSlide.startTimeMs, nextSlide.startTimeSec, durationSec)
      : durationSec
    const endTimeSec = secondsFrom(
      slide.endTimeMs,
      slide.endTimeSec,
      nextStartSec,
    )
    const safeEndTimeSec = Math.max(startTimeSec, endTimeSec)

    return {
      slideId: slide.slideId ?? index + 1,
      slideNumber: finiteNumber(slide.slideNumber, index + 1),
      title: String(slide.title ?? `슬라이드 ${finiteNumber(slide.slideNumber, index + 1)}`),
      imageUrl: slide.imageUrl ?? null,
      coreContent: String(slide.coreContent ?? ''),
      startTimeSec,
      endTimeSec: safeEndTimeSec,
      durationSec: safeEndTimeSec - startTimeSec,
      transcriptSegments: projectTranscripts(
        segments,
        slide,
        startTimeSec,
        safeEndTimeSec,
      ),
      speech: projectSpeech(windows, startTimeSec, safeEndTimeSec),
      gesture: projectGesture(gestureSeries, startTimeSec, safeEndTimeSec),
      feedback: normalizeFeedback(slide.feedback),
    }
  })

  return {
    status: value.status ?? null,
    practice: {
      ...practice,
      practiceId: practice.practiceId ?? null,
      title: String(practice.title ?? ''),
      description: String(practice.description ?? ''),
      durationSec,
    },
    presentation: {
      ...presentation,
      presentationId: presentation.presentationId ?? null,
      slideCount: finiteNumber(presentation.slideCount, slides.length),
    },
    score: {
      overallScore: finiteNumber(score.overallScore),
      folderAverageScore: finiteNumber(score.folderAverageScore),
      folderAverageDelta: finiteNumber(score.folderAverageDelta),
      contentScore: finiteNumber(score.contentScore ?? score.contentRelevanceScore),
      voiceScore: finiteNumber(score.voiceScore ?? score.deliveryScore),
      videoScore: finiteNumber(score.videoScore ?? score.nonverbalScore),
      questionAnswerScore: calculatedQuestionAnswerScore ?? providedQuestionAnswerScore,
    },
    media: {
      video: value.media?.video ?? null,
      audio: value.media?.audio ?? null,
    },
    audioStt: {
      ...(value.audioStt ?? {}),
      segments,
    },
    speechAnalysis: {
      ...(value.speechAnalysis ?? {}),
      fillerBreakdown,
      windows,
    },
    nonverbalAnalysis: value.nonverbalAnalysis ?? null,
    gestureSeries,
    slides,
    questionAnswers,
  }
}
