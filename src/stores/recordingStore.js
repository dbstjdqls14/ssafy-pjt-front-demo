import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// Live recording state shared between the record view and its rail panels
// (transcript, live stats). Kept separate from the presentation draft so it can
// be reused by the interview record flow too.
export const useRecordingStore = defineStore('recording', () => {
  const isRecording = ref(false)
  const isPaused = ref(false)
  const elapsedSeconds = ref(0)
  const transcriptSegments = ref([])
  const stats = ref({ wpm: null, fillerCount: 0, gazeHold: null, posture: null, voice: '대기', voiceDb: null })
  const mediaBlob = ref(null)

  const elapsedLabel = computed(() => {
    const m = Math.floor(elapsedSeconds.value / 60)
    const s = String(elapsedSeconds.value % 60).padStart(2, '0')
    return `${m}:${s}`
  })

  const start = () => {
    isRecording.value = true
    isPaused.value = false
    elapsedSeconds.value = 0
    transcriptSegments.value = []
    stats.value = { wpm: null, fillerCount: 0, gazeHold: null, posture: null, voice: '대기', voiceDb: null }
    mediaBlob.value = null
  }
  const pause = () => {
    isPaused.value = true
    isRecording.value = false
  }
  const resume = () => {
    isPaused.value = false
    isRecording.value = true
  }
  const stop = (blob = null) => {
    isRecording.value = false
    isPaused.value = false
    mediaBlob.value = blob
  }
  const tick = () => {
    elapsedSeconds.value += 1
  }
  const setStats = (partial) => {
    stats.value = { ...stats.value, ...partial }
  }
  const addTranscript = (text) => {
    transcriptSegments.value = [...transcriptSegments.value, text]
  }
  const reset = () => {
    stop()
    elapsedSeconds.value = 0
    transcriptSegments.value = []
    stats.value = { wpm: null, fillerCount: 0, gazeHold: null, posture: null, voice: '대기', voiceDb: null }
  }

  return {
    isRecording,
    isPaused,
    elapsedSeconds,
    transcriptSegments,
    stats,
    mediaBlob,
    elapsedLabel,
    start,
    pause,
    resume,
    stop,
    tick,
    setStats,
    addTranscript,
    reset,
  }
})
