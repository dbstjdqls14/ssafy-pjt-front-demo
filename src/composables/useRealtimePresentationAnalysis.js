import { computed, onBeforeUnmount, ref } from 'vue'

import { analyzePresentationFrame, loadPresentationVisionModels } from '../services/presentationVisionService.js'

const ANALYSIS_INTERVAL_MS = 220
const FILLER_WORDS = ['음', '어', '그', '약간', '뭐랄까', '그러니까']

export const countFillerWords = (text = '') => FILLER_WORDS.reduce((count, word) => {
  const matches = text.match(new RegExp(`(^|[\\s,.!?])${word}(?=$|[\\s,.!?])`, 'g'))
  return count + (matches?.length ?? 0)
}, 0)

export const calculateWpm = (text = '', elapsedSeconds = 0) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  if (!words || elapsedSeconds < 3) return null
  return Math.round(words / (elapsedSeconds / 60))
}

// 면접 실시간 분석과 같은 방식으로 한국어 음절 수를 실제 경과 시간으로 나눈다.
// Chrome STT가 공백을 적게 넣더라도 공백 기반 WPM처럼 계속 '느림'으로 치우치지 않는다.
export const calculateSyllablesPerSecond = (text = '', elapsedSeconds = 0) => {
  const syllables = (String(text).match(/[가-힣]/g) || []).length
  const seconds = Math.max(1, Number(elapsedSeconds) || 0)
  return syllables ? Math.round((syllables / seconds) * 10) / 10 : 0
}

export const calculateGazeHold = (scores = [], {
  threshold = 70,
  windowSize = 20,
} = {}) => {
  const recentScores = scores
    .slice(-windowSize)
    .filter((score) => Number.isFinite(score))
  if (!recentScores.length) return null
  const maintained = recentScores.filter((score) => score >= threshold).length
  return Math.round((maintained / recentScores.length) * 100)
}

export const calculatePostureAverage = (scores = [], {
  windowSize = 20,
} = {}) => {
  const recentScores = scores
    .slice(-windowSize)
    .filter((score) => Number.isFinite(score))
  if (!recentScores.length) return null
  return Math.round(
    recentScores.reduce((total, score) => total + score, 0) / recentScores.length,
  )
}

export const useRealtimePresentationAnalysis = () => {
  const modelStatus = ref('idle')
  const modelError = ref(null)
  const gazeScore = ref(null)
  const postureScore = ref(null)
  const voice = ref('대기')
  const voiceDb = ref(null)
  const faceDetected = ref(false)
  const poseDetected = ref(false)
  const delegate = ref(null)

  let frameId = null
  let videoElement = null
  let lastAnalyzedAt = 0
  let running = false
  let audioContext = null
  let analyser = null
  let audioBuffer = null
  const gazeSamples = ref(0)
  const gazeGoodSamples = ref(0)
  const postureSamples = ref(0)
  const postureTotal = ref(0)
  const sampleListeners = new Set()

  const gazeHold = computed(() => (
    gazeSamples.value
      ? Math.round((gazeGoodSamples.value / gazeSamples.value) * 100)
      : null
  ))
  const postureAverage = computed(() => (
    postureSamples.value
      ? Math.round(postureTotal.value / postureSamples.value)
      : null
  ))
  const isReady = computed(() => modelStatus.value === 'ready' || modelStatus.value === 'running')

  const loadModels = async () => {
    if (isReady.value) return true
    modelStatus.value = 'loading'
    modelError.value = null
    try {
      const models = await loadPresentationVisionModels()
      delegate.value = models.delegate
      modelStatus.value = 'ready'
      return true
    } catch (error) {
      modelStatus.value = 'error'
      modelError.value = error
      return false
    }
  }

  const setupAudio = async (stream) => {
    const audioTrack = stream?.getAudioTracks?.()[0]
    if (!audioTrack || typeof window.AudioContext !== 'function') return

    audioContext = new window.AudioContext()
    const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]))
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.75
    audioBuffer = new Float32Array(analyser.fftSize)
    source.connect(analyser)
    if (audioContext.state === 'suspended') await audioContext.resume()
  }

  const sampleAudio = () => {
    if (!analyser || !audioBuffer) return
    analyser.getFloatTimeDomainData(audioBuffer)
    const rms = Math.sqrt(audioBuffer.reduce((sum, value) => sum + value * value, 0) / audioBuffer.length)
    const decibels = rms > 0 ? 20 * Math.log10(rms) : -100
    voiceDb.value = Math.round(decibels)
    voice.value = decibels < -48 ? '작음' : decibels > -18 ? '큼' : '안정'
  }

  const loop = async (now) => {
    if (!running) return
    frameId = window.requestAnimationFrame(loop)
    sampleAudio()

    if (!videoElement || videoElement.readyState < 2 || now - lastAnalyzedAt < ANALYSIS_INTERVAL_MS) return
    lastAnalyzedAt = now

    try {
      const result = await analyzePresentationFrame(videoElement, now)
      faceDetected.value = result.faceDetected
      poseDetected.value = result.poseDetected
      delegate.value = result.delegate

      if (result.gazeScore != null) {
        gazeScore.value = result.gazeScore
        gazeSamples.value += 1
        if (result.gazeScore >= 70) gazeGoodSamples.value += 1
      }
      if (result.postureScore != null) {
        postureScore.value = result.postureScore
        postureSamples.value += 1
        postureTotal.value += result.postureScore
      }
      sampleListeners.forEach((listener) => {
        try {
          listener({ ...result })
        } catch {
          // 분석 프레임은 UI 보조 수집기의 오류와 무관하게 계속 처리한다.
        }
      })
    } catch (error) {
      modelStatus.value = 'error'
      modelError.value = error
      running = false
    }
  }

  const start = async (video, stream) => {
    videoElement = video
    const loaded = await loadModels()
    if (!loaded) return false
    if (!audioContext) await setupAudio(stream)
    running = true
    modelStatus.value = 'running'
    frameId = window.requestAnimationFrame(loop)
    return true
  }

  const pause = () => {
    running = false
    if (frameId) window.cancelAnimationFrame(frameId)
    frameId = null
    if (isReady.value) modelStatus.value = 'ready'
  }

  const resume = () => {
    if (!videoElement || running || !isReady.value) return
    running = true
    modelStatus.value = 'running'
    frameId = window.requestAnimationFrame(loop)
  }

  const stop = async () => {
    pause()
    videoElement = null
    analyser = null
    audioBuffer = null
    if (audioContext) await audioContext.close().catch(() => {})
    audioContext = null
  }

  const reset = () => {
    gazeScore.value = null
    postureScore.value = null
    voice.value = '대기'
    voiceDb.value = null
    faceDetected.value = false
    poseDetected.value = false
    gazeSamples.value = 0
    gazeGoodSamples.value = 0
    postureSamples.value = 0
    postureTotal.value = 0
  }

  const subscribeSamples = (listener) => {
    if (typeof listener !== 'function') return () => {}
    sampleListeners.add(listener)
    return () => sampleListeners.delete(listener)
  }

  onBeforeUnmount(() => { void stop() })

  return {
    modelStatus,
    modelError,
    isReady,
    gazeScore,
    gazeHold,
    postureScore,
    postureAverage,
    voice,
    voiceDb,
    faceDetected,
    poseDetected,
    delegate,
    loadModels,
    start,
    pause,
    resume,
    subscribeSamples,
    stop,
    reset,
  }
}
