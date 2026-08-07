import { computed, ref } from 'vue'

const getSpeechRecognition = () => window.SpeechRecognition ?? window.webkitSpeechRecognition

export const useSpeechRecognition = () => {
  const recognition = ref(null)
  const finalSegments = ref([])
  const interimText = ref('')
  const isListening = ref(false)
  const error = ref(null)

  const transcript = computed(() => [...finalSegments.value, interimText.value].filter(Boolean).join(' '))

  const start = ({ lang = 'ko-KR', continuous = true, interimResults = true } = {}) => {
    const SpeechRecognition = getSpeechRecognition()

    if (!SpeechRecognition) {
      throw new Error('SpeechRecognition is not supported in this browser.')
    }

    recognition.value = new SpeechRecognition()
    recognition.value.lang = lang
    recognition.value.continuous = continuous
    recognition.value.interimResults = interimResults

    recognition.value.onresult = (event) => {
      let nextInterim = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0]?.transcript?.trim()

        if (!text) {
          continue
        }

        if (result.isFinal) {
          finalSegments.value = [...finalSegments.value, text]
        } else {
          nextInterim = text
        }
      }

      interimText.value = nextInterim
    }

    recognition.value.onerror = (event) => {
      error.value = event
    }

    recognition.value.onend = () => {
      isListening.value = false
    }

    recognition.value.start()
    isListening.value = true
  }

  const stop = () => {
    recognition.value?.stop()
    isListening.value = false
  }

  const reset = () => {
    finalSegments.value = []
    interimText.value = ''
    error.value = null
  }

  return {
    recognition,
    finalSegments,
    interimText,
    transcript,
    isListening,
    error,
    start,
    stop,
    reset,
  }
}
