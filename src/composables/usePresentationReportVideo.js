import { computed, ref } from 'vue'

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

export const presentationClock = (seconds) => {
  const safe = Math.max(0, Math.round(Number(seconds) || 0))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export function usePresentationReportVideo({ slides, selectedIndex }) {
  const videoEl = ref(null)
  const absoluteSec = ref(0)
  const isPlaying = ref(false)

  const selectedSlide = computed(() => slides.value[selectedIndex.value] ?? null)
  const totalDurationSec = computed(() => Math.max(
    0,
    ...slides.value.map((slide) => Number(slide.endTimeSec) || 0),
  ))
  const localSec = computed(() => {
    const start = Number(selectedSlide.value?.startTimeSec) || 0
    const duration = Number(selectedSlide.value?.durationSec) || 0
    return clamp(absoluteSec.value - start, 0, duration)
  })
  const progressPct = computed(() => totalDurationSec.value
    ? clamp((absoluteSec.value / totalDurationSec.value) * 100, 0, 100)
    : 0)

  const setVideoElement = (element) => {
    videoEl.value = element ?? null
  }

  const seekAbsolute = (seconds) => {
    const target = clamp(Number(seconds) || 0, 0, totalDurationSec.value)
    absoluteSec.value = target
    if (videoEl.value) videoEl.value.currentTime = target
  }

  const selectSlide = (index) => {
    const nextIndex = clamp(Number(index) || 0, 0, Math.max(0, slides.value.length - 1))
    selectedIndex.value = nextIndex
    seekAbsolute(slides.value[nextIndex]?.startTimeSec ?? 0)
  }

  const seekLocal = (seconds) => {
    const slide = selectedSlide.value
    if (!slide) return
    seekAbsolute(Math.min(
      Number(slide.endTimeSec) || 0,
      (Number(slide.startTimeSec) || 0) + Math.max(0, Number(seconds) || 0),
    ))
  }

  const onTimeUpdate = (event) => {
    absoluteSec.value = Math.max(0, Number(event?.target?.currentTime) || 0)
    const matchingIndex = slides.value.findIndex((slide, index) => {
      const start = Number(slide.startTimeSec) || 0
      const end = Number(slide.endTimeSec) || start
      const isLast = index === slides.value.length - 1
      return absoluteSec.value >= start && (absoluteSec.value < end || (isLast && absoluteSec.value <= end))
    })
    if (matchingIndex >= 0) selectedIndex.value = matchingIndex
  }

  const togglePlay = async () => {
    if (!videoEl.value) return
    if (videoEl.value.paused) await videoEl.value.play()
    else videoEl.value.pause()
  }

  const onPlay = () => { isPlaying.value = true }
  const onPause = () => { isPlaying.value = false }

  const scrubFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = rect.width
      ? clamp((event.clientX - rect.left) / rect.width, 0, 1)
      : 0
    seekAbsolute(ratio * totalDurationSec.value)
  }

  // 진행 바는 클릭만이 아니라 드래그로도 움직여야 한다(면접 리포트와 동일).
  // 포인터 캡처로 바 밖까지 끌어도 계속 따라온다.
  const isScrubbing = ref(false)
  const onScrubPointerDown = (event) => {
    isScrubbing.value = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    scrubFromPointer(event)
  }
  const onScrubPointerMove = (event) => {
    if (!isScrubbing.value) return
    scrubFromPointer(event)
  }
  const onScrubPointerUp = (event) => {
    if (isScrubbing.value) scrubFromPointer(event)
    isScrubbing.value = false
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  const onScrubPointerCancel = () => { isScrubbing.value = false }

  const reset = () => {
    videoEl.value = null
    absoluteSec.value = 0
    isPlaying.value = false
    isScrubbing.value = false
  }

  return {
    videoEl,
    absoluteSec,
    isPlaying,
    selectedSlide,
    totalDurationSec,
    localSec,
    progressPct,
    setVideoElement,
    seekAbsolute,
    seekLocal,
    selectSlide,
    onTimeUpdate,
    togglePlay,
    onPlay,
    onPause,
    scrubFromPointer,
    isScrubbing,
    onScrubPointerDown,
    onScrubPointerMove,
    onScrubPointerUp,
    onScrubPointerCancel,
    reset,
  }
}
