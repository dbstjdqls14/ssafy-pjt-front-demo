const finiteNonNegative = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

const answerDurationOf = (question) => {
  const rawStart = finiteNonNegative(question?.rawStartSec)
  const rawEnd = finiteNonNegative(question?.rawEndSec)
  if (rawStart != null && rawEnd != null && rawEnd > rawStart) return rawEnd - rawStart

  const answerDuration = finiteNonNegative(question?.answerDurationSec)
  if (answerDuration != null && answerDuration > 0) return answerDuration

  const fallbackDuration = finiteNonNegative(question?.durationSec)
  return fallbackDuration != null && fallbackDuration > 0 ? fallbackDuration : 0
}

/**
 * Builds the timeline of the stitched answer video.
 *
 * Server question start/end values belong to the interview clock and may contain
 * gaps around TTS playback. The saved video contains only answer recordings, so
 * those gaps must not be used as media positions. We concatenate the measured
 * answer durations and, when the actual stitched media duration is known,
 * shrink boundaries only when the media is shorter than the measured answers.
 * MediaRecorder may report a longer duration because paused/TTS time remains in
 * its timestamp metadata; that surplus must never stretch answer intervals.
 */
export const buildQuestionPlaybackTimeline = (questions, mediaDurationSec = null) => {
  if (!Array.isArray(questions) || questions.length === 0) return []

  const durations = questions.map((question) => (
    question?.isVideoMapped === false ? 0 : answerDurationOf(question)
  ))
  const measuredTotal = durations.reduce((sum, duration) => sum + duration, 0)
  const targetDuration = finiteNonNegative(mediaDurationSec)
  const scale = measuredTotal > 0 && targetDuration != null && targetDuration > 0 && targetDuration < measuredTotal
    ? targetDuration / measuredTotal
    : 1

  let cursor = 0
  return questions.map((question, index) => {
    const durationSec = durations[index] * scale
    if (question?.isVideoMapped === false || durationSec <= 0) {
      return {
        ...question,
        startSec: null,
        durationSec: 0,
        isVideoMapped: false,
      }
    }

    const result = {
      ...question,
      startSec: cursor,
      durationSec,
      isVideoMapped: true,
    }
    cursor += durationSec
    return result
  })
}

export const questionIndexAtTime = (questions, timeSec) => {
  if (!Array.isArray(questions) || questions.length === 0) return 0

  const targetSec = Math.max(0, Number(timeSec) || 0)
  for (let index = questions.length - 1; index >= 0; index -= 1) {
    const durationSec = finiteNonNegative(questions[index]?.durationSec)
    if (questions[index]?.isVideoMapped === false || durationSec == null || durationSec <= 0) continue
    const startSec = finiteNonNegative(questions[index]?.startSec)
    if (startSec != null && targetSec >= startSec) return index
  }

  const firstMappedIndex = questions.findIndex((question) => {
    const durationSec = finiteNonNegative(question?.durationSec)
    return question?.isVideoMapped !== false && durationSec != null && durationSec > 0
  })
  return firstMappedIndex >= 0 ? firstMappedIndex : 0
}
