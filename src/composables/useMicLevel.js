import { onBeforeUnmount, ref } from 'vue'

// 마이크 스트림의 실시간 음량(RMS)을 0~1로 정규화해 반환한다. 통화 앱의
// "마이크 테스트" 막대처럼 말할 때만 올라가고 조용하면 바로 가라앉게, 값이
// 오르는 건 즉시·내리는 건 살짝 느리게(감쇠) 반영해 눈에 자연스럽다.
const RISE = 1 // 오를 때는 즉시 반영
const FALL = 0.35 // 내릴 때는 부드럽게(막대가 뚝뚝 끊기지 않도록)
// 사람 목소리의 RMS는 대개 0.02~0.25 사이라 이 구간을 0~1로 늘려 체감 반응을 키운다.
const FLOOR = 0.01
const CEIL = 0.35

export const useMicLevel = () => {
  const level = ref(0) // 0~1
  let audioCtx = null
  let analyser = null
  let source = null
  let rafId = null
  let buffer = null

  const tick = () => {
    if (!analyser) return
    analyser.getByteTimeDomainData(buffer)
    let sumSquares = 0
    for (let i = 0; i < buffer.length; i += 1) {
      const centered = (buffer[i] - 128) / 128
      sumSquares += centered * centered
    }
    const rms = Math.sqrt(sumSquares / buffer.length)
    const normalized = Math.min(1, Math.max(0, (rms - FLOOR) / (CEIL - FLOOR)))
    const smoothing = normalized > level.value ? RISE : FALL
    level.value += (normalized - level.value) * smoothing
    rafId = requestAnimationFrame(tick)
  }

  const start = (mediaStream) => {
    stop()
    const audioTrack = mediaStream?.getAudioTracks?.()[0]
    if (!audioTrack) return
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext
      audioCtx = new Ctor()
      source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]))
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0
      buffer = new Uint8Array(analyser.fftSize)
      source.connect(analyser)
      rafId = requestAnimationFrame(tick)
    } catch {
      // AudioContext 생성 불가 환경 — 막대는 0에 머문다.
    }
  }

  const stop = () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
    try { source?.disconnect() } catch { /* noop */ }
    try { void audioCtx?.close() } catch { /* noop */ }
    audioCtx = null
    analyser = null
    source = null
    level.value = 0
  }

  onBeforeUnmount(stop)

  return { level, start, stop }
}
