import { computed, ref } from 'vue'

// 면접 리포트에서 쓰던 "질문 단위 음성 그래프" 엔진을 발표 리포트(슬라이드
// 단위)에서도 그대로 쓰기 위해 뽑아낸 공용 로직. 그래프 모양·상호작용이
// 두 화면에서 완전히 똑같이 동작해야 하므로, 숫자 공식 자체를 한 곳에 둔다.

export const toClock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`

// 실제 분석은 10초 단위로 끊어 구간 평균을 낸다 — 그래프도 그 방식과 똑같이
// 계단(step) 모양으로 그린다.
const BUCKET_SEC = 10

// 실측 시계열이 아직 없어(백엔드는 10초 구간 평균을 제공 예정), 구간 길이
// 기준으로 그럴듯한 계단형 값을 만든다(구간마다 seed로 살짝 변주).
export const buildVoicePaceMock = (durationSec, seed = 0) => {
  const bucketCount = Math.max(1, Math.ceil(durationSec / BUCKET_SEC))
  const basePace = 3.6 + ((seed % 5) * 0.15)
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const startSec = i * BUCKET_SEC
    const endSec = Math.min(durationSec, startSec + BUCKET_SEC)
    const wave = Math.sin((i + seed) * 0.7) * 0.9 + Math.sin((i + seed * 2) * 0.33) * 0.4
    return { startSec, endSec, pace: Math.max(1.2, Math.round((basePace + wave) * 10) / 10) }
  })
  const avgPace = Math.round((buckets.reduce((sum, b) => sum + b.pace, 0) / buckets.length) * 10) / 10
  // 최저/최고를 버킷 하나가 아니라, 같은 값이 이어지는 구간 전체로 잡는다 —
  // 안 그러면 바로 옆 10초가 시각적으로 똑같은 높이인데도 표시가 안 돼 헷갈린다.
  const extremeRange = (isMoreExtreme) => {
    const extremeValue = buckets.reduce((acc, b) => (isMoreExtreme(b.pace, acc) ? b.pace : acc), buckets[0].pace)
    const startIdx = buckets.findIndex((b) => b.pace === extremeValue)
    let endIdx = startIdx
    while (endIdx + 1 < buckets.length && buckets[endIdx + 1].pace === extremeValue) endIdx += 1
    return { startSec: buckets[startIdx].startSec, endSec: buckets[endIdx].endSec, pace: extremeValue }
  }
  const slowest = extremeRange((a, b) => a < b)
  const fastest = extremeRange((a, b) => a > b)

  const fillerTotal = Math.max(1, Math.round(durationSec / 11) + (seed % 3))
  const eo = Math.max(1, Math.round(fillerTotal * 0.7))
  const geu = Math.max(0, Math.round(fillerTotal * 0.2))
  const eum = Math.max(0, fillerTotal - eo - geu)
  const hasSilence = seed % 4 === 0
  return {
    buckets,
    avgPace,
    slowest,
    fastest,
    fillerTotal,
    fillerBreakdown: [['어', eo], ['그', geu], ['음', eum]].filter(([, n]) => n > 0),
    longSilenceCount: hasSilence ? 1 : 0,
    silences: hasSilence ? [{ startSec: Math.round(durationSec * 0.42), endSec: Math.round(durationSec * 0.42) + 2 }] : [],
  }
}

// 면접은 "초당 음절", 발표는 "WPM(분당 어절)"로 속도를 재기 때문에 표시 단위와
// y축 여유폭만 화면별로 갈라진다. 그래프 모양·상호작용은 완전히 같아야 하므로
// 이 두 가지만 옵션으로 받고 나머지 계산은 공유한다.
const DEFAULT_PACE_OPTIONS = {
  formatPace: (pace) => `초당 ${Number(pace).toFixed(1)}음절`,
  // y축 위/아래로 두는 여유. 값 범위가 3~5인 음절 단위 기준값이다.
  padding: 0.4,
}

// voicePaceRef: computed/ref로 { buckets, avgPace, slowest, fastest,
//   fillerBreakdown, fillerTotal, longSilenceCount, silences } 제공.
// durationSecRef: 지금 그리는 구간(질문/슬라이드)의 길이(초) 제공.
export function useVoicePaceGraph(voicePaceRef, durationSecRef, options = {}) {
  const { formatPace, padding } = { ...DEFAULT_PACE_OPTIONS, ...options }
  const paceChartEl = ref(null)

  const safeDurationSec = () => Math.max(1, Number(durationSecRef.value) || 0)
  const pcOfSec = (sec) => Math.min(100, Math.max(0, (sec / safeDurationSec()) * 100))
  const xForSec = (sec) => pcOfSec(sec) * 6

  // 백엔드가 버킷을 항상 시작 시각 순으로 내려준다는 보장이 없다(실제로
  // 뒤죽박죽 순서로 오는 응답을 확인함) — 정렬 없이 배열 순서 그대로 이으면
  // 그래프가 시간을 거슬러 대각선으로 튀는 삼각형 모양이 된다.
  const sortedBuckets = computed(() => (
    [...(voicePaceRef.value?.buckets ?? [])].sort((a, b) => a.startSec - b.startSec)
  ))

  // 답변이 제한 시간 전에 중간에 끊긴 경우, 버킷 자체가 실제로 말이 끝난
  // 시점에서 멈춘다(그 뒤로는 데이터가 없음) — 그래프 오른쪽 끝(=durationSec)이
  // 아니라 이 마지막 버킷 끝 시각에 "여기서 다음으로 넘어감" 표시를 남겨야 한다.
  const lastRealSec = computed(() => {
    const buckets = sortedBuckets.value
    return buckets.length ? buckets[buckets.length - 1].endSec : 0
  })
  const cutoffPct = computed(() => pcOfSec(lastRealSec.value))

  const fillerEvents = computed(() => {
    const vp = voicePaceRef.value
    // 정확한 발생 시각이 없으면 점을 만들지 않는다. 총량을 시간축에 균등하게
    // 뿌리면 실제 분석 결과처럼 보이므로 fillerEvents가 온 경우만 렌더링한다.
    return Array.isArray(vp?.fillerEvents) ? vp.fillerEvents : []
  })

  const paceYBounds = computed(() => {
    const vp = voicePaceRef.value
    const paces = sortedBuckets.value.map((b) => Number(b.pace)).filter(Number.isFinite)
    const avgPace = Number(vp?.avgPace)
    if (!paces.length) return { lo: 0, hi: 1 }
    // 말 속도는 음수가 될 수 없으므로 여유폭을 빼도 0 아래로는 내려가지 않는다.
    const lo = Math.max(0, Math.min(...paces, Number.isFinite(avgPace) ? avgPace : paces[0]) - padding)
    const hi = Math.max(...paces, Number.isFinite(avgPace) ? avgPace : paces[0]) + padding
    return { lo, hi: hi > lo ? hi : lo + 1 }
  })
  const paceYFor = (pace) => {
    const { lo, hi } = paceYBounds.value
    return 100 - ((pace - lo) / (hi - lo)) * 100
  }
  const paceAtSec = (sec) => {
    const buckets = sortedBuckets.value
    if (!buckets.length) return 0
    const bucket = buckets.find((b) => sec >= b.startSec && sec < b.endSec) ?? buckets[buckets.length - 1]
    return bucket.pace
  }

  // 10초 버킷 평균을 그대로 이어 붙인 계단(step) 그래프 — x같은 지점에서 y가
  // 바뀌면 자동으로 수직선이 그려져 실제 계단 모양이 된다.
  const paceChartPath = computed(() => (
    sortedBuckets.value.reduce((d, b, i) => {
      const x0 = xForSec(b.startSec)
      const x1 = xForSec(b.endSec)
      const y = paceYFor(b.pace)
      return `${d}${i === 0 ? `M${x0},${y} ` : `L${x0},${y} `}L${x1},${y} `
    }, '').trim()
  ))
  // 평균 속도는 이제 구간(범위)이 아니라 값 하나라 수평선 하나로 표시.
  const avgLineStyle = computed(() => ({ '--avg-y': `${paceYFor(voicePaceRef.value?.avgPace ?? 0)}%` }))

  // 최저/최고 구간도 곡선 위 강조선이 아니라 침묵 구간과 같은 배경 블록으로 표시.
  const toBackgroundRange = (range) => ({
    leftPct: pcOfSec(range.startSec),
    widthPct: Math.max(0.6, pcOfSec(range.endSec) - pcOfSec(range.startSec)),
  })
  const rangeOverlays = computed(() => ({
    slow: toBackgroundRange(voicePaceRef.value?.slowest ?? { startSec: 0, endSec: 0 }),
    fast: toBackgroundRange(voicePaceRef.value?.fastest ?? { startSec: 0, endSec: 0 }),
  }))

  const paceMarkers = computed(() => {
    const vp = voicePaceRef.value
    if (!vp?.slowest || !vp?.fastest) return []
    return [
      {
        key: 'slow',
        label: '가장 느린 구간',
        startSec: vp.slowest.startSec,
        pace: formatPace(vp.slowest.pace),
        rangeSec: [vp.slowest.startSec, vp.slowest.endSec],
        leftPct: pcOfSec((vp.slowest.startSec + vp.slowest.endSec) / 2),
        topPct: paceYFor(vp.slowest.pace),
      },
      {
        key: 'fast',
        label: '가장 빠른 구간',
        startSec: vp.fastest.startSec,
        pace: formatPace(vp.fastest.pace),
        rangeSec: [vp.fastest.startSec, vp.fastest.endSec],
        leftPct: pcOfSec((vp.fastest.startSec + vp.fastest.endSec) / 2),
        topPct: paceYFor(vp.fastest.pace),
      },
    ]
  })

  // 추임새 점: 계단 그래프는 구간마다 y값이 고정돼 있어(버킷 조회) DOM 경로
  // 측정 없이 바로 좌표를 계산할 수 있다.
  const fillerDotPositions = computed(() => fillerEvents.value.map((f) => ({
    ...f,
    xPct: pcOfSec(f.atSec),
    yPct: paceYFor(paceAtSec(f.atSec)),
  })))

  // 침묵 구간은 곡선을 따라가지 않고 그냥 회색 배경 블록으로 표시.
  const silenceSegments = computed(() => (voicePaceRef.value?.silences ?? []).map((s) => ({
    ...s,
    leftPct: pcOfSec(s.startSec),
    widthPct: Math.max(0.6, pcOfSec(s.endSec) - pcOfSec(s.startSec)),
  })))

  return {
    paceChartEl,
    formatPace,
    pcOfSec,
    fillerEvents,
    silenceSegments,
    paceChartPath,
    avgLineStyle,
    paceMarkers,
    paceYFor,
    paceYBounds,
    paceAtSec,
    fillerDotPositions,
    rangeOverlays,
    lastRealSec,
    cutoffPct,
  }
}
