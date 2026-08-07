const roundOne = (value) => Math.round(value * 10) / 10

export const toInterviewAlignedDetectionSample = ({
  faceDetected,
  gazeFrontal,
  postureTilted,
}) => {
  if (typeof gazeFrontal !== 'boolean' || typeof postureTilted !== 'boolean') {
    return null
  }

  const hasFace = faceDetected === true
  return {
    postureScore: hasFace && postureTilted === false ? 100 : 0,
    gazeScore: hasFace && gazeFrontal === true ? 100 : 0,
    poseDetected: hasFace,
    faceDetected: hasFace,
  }
}

export const buildSlideVisitText = ({
  slides = [],
  visits = [],
  transcripts = [],
}) => {
  const pageBySlideId = new Map(
    slides.map((slide, index) => [
      String(slide.id ?? slide.slideId),
      Number(slide.number ?? slide.slideNumber ?? index + 1),
    ]),
  )

  return visits.map((visit, index) => {
    const startedAtMs = Math.max(0, Math.round(
      visit.startedAtMs ?? (visit.startedAtSeconds ?? 0) * 1_000,
    ))
    const nextVisit = visits[index + 1]
    const endedAtMs = visit.endedAtMs != null
      ? Math.round(visit.endedAtMs)
      : visit.endedAtSeconds != null
        ? Math.round(visit.endedAtSeconds * 1_000)
        : nextVisit?.startedAtMs != null
          ? Math.round(nextVisit.startedAtMs)
          : Number.POSITIVE_INFINITY

    const content = transcripts
      .filter((entry) => {
        const atMs = Math.round(entry.atMs ?? (entry.atSeconds ?? 0) * 1_000)
        return atMs >= startedAtMs && atMs < endedAtMs
      })
      .map((entry) => String(entry.text ?? '').trim())
      .filter(Boolean)
      .join(' ')

    return {
      page: pageBySlideId.get(String(visit.slideId))
        ?? Number(visit.slideNumber ?? visit.slideIndex + 1),
      timestamp: startedAtMs,
      content,
    }
  })
}

export class PresentationDetectionAccumulator {
  constructor({
    windowDurationMs = 10_000,
    postureThreshold = 60,
    gazeThreshold = 70,
  } = {}) {
    this.windowDurationMs = windowDurationMs
    this.postureThreshold = postureThreshold
    this.gazeThreshold = gazeThreshold
    this.windows = new Map()
    this.postureOutlierActive = false
    this.sideGlanceActive = false
    this.sampleCount = 0
    this.tiltedSampleCount = 0
    this.gazeEvents = []
  }

  add({
    timestamp,
    postureScore,
    gazeScore,
    poseDetected,
    faceDetected,
  }) {
    const at = Math.max(0, Math.round(timestamp))
    const sequence = Math.floor(at / this.windowDurationMs)
    const window = this.#window(sequence)

    if (Number.isFinite(postureScore)) {
      const score = Number(postureScore)
      window.postureScores.push(score)
      window.postureSampleCount += 1
      this.sampleCount += 1
      const isOutlier = score < this.postureThreshold
      if (isOutlier) {
        window.tiltedSampleCount += 1
        this.tiltedSampleCount += 1
      }
      if (isOutlier && !this.postureOutlierActive) window.outlierList.push(at)
      this.postureOutlierActive = isOutlier
    } else if (poseDetected === true) {
      this.postureOutlierActive = false
    }

    const hasGazeMeasurement = Number.isFinite(gazeScore) || faceDetected === false
    if (hasGazeMeasurement) {
      const isSideGlance = faceDetected === false || gazeScore < this.gazeThreshold
      if (isSideGlance && !this.sideGlanceActive) {
        window.sideGlance.push(at)
        this.gazeEvents.push({ atSec: roundOne(at / 1_000) })
      }
      this.sideGlanceActive = isSideGlance
    }
  }

  finish(durationMs) {
    const windowCount = Math.max(0, Math.ceil(durationMs / this.windowDurationMs))
    return Array.from({ length: windowCount }, (_, sequence) => {
      const window = this.#window(sequence)
      const total = window.postureScores.reduce((sum, score) => sum + score, 0)
      return {
        timestamp: sequence * this.windowDurationMs,
        sequence,
        bodyStability: {
          average: window.postureScores.length
            ? roundOne(total / window.postureScores.length)
            : 0,
          outlierList: window.outlierList,
        },
        sideGlance: window.sideGlance,
      }
    })
  }

  finishNonverbal(durationMs) {
    const safeDurationMs = Math.max(0, Math.round(Number(durationMs) || 0))
    const detects = this.finish(safeDurationMs)

    return {
      gazeDeviationCount: this.gazeEvents.length,
      postureTiltPercent: this.sampleCount
        ? roundOne((this.tiltedSampleCount / this.sampleCount) * 100)
        : 0,
      sampleCount: this.sampleCount,
      gazeEvents: [...this.gazeEvents],
      tiltBuckets: detects.map((detect) => {
        const window = this.#window(detect.sequence)
        return {
          startSec: detect.timestamp / 1_000,
          endSec: Math.min(
            safeDurationMs,
            detect.timestamp + this.windowDurationMs,
          ) / 1_000,
          tiltPct: window.postureSampleCount
            ? roundOne((window.tiltedSampleCount / window.postureSampleCount) * 100)
            : 0,
        }
      }),
    }
  }

  #window(sequence) {
    if (!this.windows.has(sequence)) {
      this.windows.set(sequence, {
        postureScores: [],
        postureSampleCount: 0,
        tiltedSampleCount: 0,
        outlierList: [],
        sideGlance: [],
      })
    }
    return this.windows.get(sequence)
  }
}
