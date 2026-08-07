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
  let gazeSamples = 0
  let gazeGoodSamples = 0
  let postureSamples = 0
  let postureTotal = 0

  const gazeHold = computed(() => (
    gazeSamples ? Math.round((gazeGoodSamples / gazeSamples) * 100) : null
  ))
  const postureAverage = computed(() => (
    postureSamples ? Math.round(postureTotal / postureSamples) : null
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
        gazeSamples += 1
        if (result.gazeScore >= 70) gazeGoodSamples += 1
      }
      if (result.postureScore != null) {
        postureScore.value = result.postureScore
        postureSamples += 1
        postureTotal += result.postureScore
      }
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
    gazeSamples = 0
    gazeGoodSamples = 0
    postureSamples = 0
    postureTotal = 0
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
    stop,
    reset,
  }
}
