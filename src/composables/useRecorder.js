import { computed, onBeforeUnmount, ref } from 'vue'

export const useRecorder = () => {
  const recorder = ref(null)
  const chunks = ref([])
  const mediaBlob = ref(null)
  const isRecording = ref(false)
  const isPaused = ref(false)
  let stopPromise = null

  const canFinish = computed(() => !isRecording.value && Boolean(mediaBlob.value))

  const start = (stream, options = {}) => {
    chunks.value = []
    mediaBlob.value = null
    stopPromise = null

    recorder.value = new MediaRecorder(stream, options)
    recorder.value.addEventListener('dataavailable', (event) => {
      if (event.data?.size) {
        chunks.value.push(event.data)
      }
    })
    recorder.value.addEventListener('stop', () => {
      mediaBlob.value = new Blob(chunks.value, {
        type: recorder.value?.mimeType || 'video/webm',
      })
      isRecording.value = false
      isPaused.value = false
    })

    recorder.value.start()
    isRecording.value = true
    isPaused.value = false
  }

  const pause = () => {
    if (recorder.value?.state === 'recording') {
      recorder.value.pause()
      isPaused.value = true
    }
  }

  const resume = () => {
    if (recorder.value?.state === 'paused') {
      recorder.value.resume()
      isPaused.value = false
    }
  }

  const stop = () => {
    if (mediaBlob.value) return Promise.resolve(mediaBlob.value)
    if (!recorder.value || recorder.value.state === 'inactive') return Promise.resolve(null)
    if (stopPromise) return stopPromise

    stopPromise = new Promise((resolve) => {
      recorder.value.addEventListener('stop', () => resolve(mediaBlob.value), { once: true })
      recorder.value.stop()
    })
    return stopPromise
  }

  onBeforeUnmount(() => { void stop() })

  return {
    recorder,
    mediaBlob,
    isRecording,
    isPaused,
    canFinish,
    start,
    pause,
    resume,
    stop,
  }
}
