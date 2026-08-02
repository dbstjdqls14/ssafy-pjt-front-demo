import { computed, ref, shallowRef } from 'vue'

const getSpeechRecognition = () => window.SpeechRecognition ?? window.webkitSpeechRecognition

export const useSpeechRecognition = () => {
  const recognition = shallowRef(null)
  const finalSegments = ref([])
  const interimText = ref('')
  const isListening = ref(false)
  const error = ref(null)
  let shouldListen = false

  const transcript = computed(() => [...finalSegments.value, interimText.value].filter(Boolean).join(' '))

  const start = ({ lang = 'ko-KR', continuous = true, interimResults = true } = {}) => {
    const SpeechRecognition = getSpeechRecognition()

    if (!SpeechRecognition) {
      throw new Error('SpeechRecognition is not supported in this browser.')
    }

    shouldListen = true
    const instance = new SpeechRecognition()
    recognition.value = instance
    instance.lang = lang
    instance.continuous = continuous
    instance.interimResults = interimResults

    instance.onresult = (event) => {
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

    instance.onerror = (event) => {
      error.value = event
    }

    instance.onend = () => {
      if (recognition.value !== instance) return
      if (shouldListen) {
        try {
          instance.start()
          isListening.value = true
        } catch (restartError) {
          error.value = restartError
          isListening.value = false
        }
        return
      }
      isListening.value = false
    }

    instance.start()
    isListening.value = true
  }

  const stop = () => {
    shouldListen = false
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
