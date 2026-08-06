import { computed, ref } from 'vue'

export const formatTiltPercent = (value) => {
  const parsed = Number(value)
  return (Number.isFinite(parsed) ? parsed : 0).toFixed(1)
}

// 몸짓 탭의 두 지표는 성격이 달라서 표현 방식도 다르게 간다 — 기울기는
// "지금 몇 %인지"가 계속 바뀌는 연속값이라 라인 그래프로, 시선 이탈은
// "몇 번 벗어났는지"만 세는 사건이라 음성 탭의 추임새처럼 점(도트)으로 찍는다.
const BUCKET_SEC = 10

// 응답에 question.gestureSeries가 없을 때만 쓰는 대체값(구간 길이 기준으로
// 그럴듯한 값을 만듦). 실측이 있으면 InterviewReportDetailView.vue가 이 목
// 대신 API의 gestureSeries(buckets[].tiltPercent, gazeEvents[].atSec)를
// 그대로 넘긴다 — 이 함수가 만드는 값과 필드명이 같아야 그래프 코드가 동일하게
// 동작한다.
export const buildGestureSeriesMock = (durationSec, seed = 0) => {
  const bucketCount = Math.max(1, Math.ceil(durationSec / BUCKET_SEC))
  const baseTilt = 9 + ((seed + 2) % 4) * 4
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const startSec = i * BUCKET_SEC
    const endSec = Math.min(durationSec, startSec + BUCKET_SEC)
    const tiltWave = Math.cos((i + seed + 1) * 0.5) * 8 + Math.sin((i + seed) * 0.4) * 3
    return { startSec, endSec, tiltPercent: Math.max(0, Math.min(100, Math.round(baseTilt + tiltWave))) }
  })
  // 시선 이탈은 횟수만 의미가 있어 퍼센트는 만들지 않는다 — 그래프에 찍을
  // 대략적인 발생 시각만 구간에 고르게 배치해 근사한다.
  const gazeCount = Math.max(0, 1 + (seed % 3))
  const step = durationSec / (gazeCount + 1)
  const gazeEvents = Array.from({ length: gazeCount }, (_, i) => ({ atSec: Math.round(step * (i + 1)) }))
  return { buckets, gazeCount, gazeEvents }
}

// seriesRef: { buckets: [{startSec,endSec,tiltPercent}], gazeCount, gazeEvents } 제공.
// durationSecRef: 지금 그리는 구간(질문/슬라이드)의 길이(초) 제공.
export function useGestureGraph(seriesRef, durationSecRef) {
  const chartEl = ref(null)
  const safeDurationSec = () => Math.max(1, Number(durationSecRef.value) || 0)
  const xForSec = (sec) => (sec / safeDurationSec()) * 600
  const pcOfSec = (sec) => Math.min(100, Math.max(0, (sec / safeDurationSec()) * 100))

  // 음성 그래프와 같은 이유로 정렬해서 쓴다 — 백엔드 버킷 순서가 시간순이라는
  // 보장이 없어, 정렬 없이 이으면 선이 시간을 거슬러 대각선으로 튄다.
  const sortedBuckets = computed(() => (
    [...(seriesRef.value?.buckets ?? [])].sort((a, b) => a.startSec - b.startSec)
  ))

  // tiltPoints는 마지막 점을 항상 durationSec까지 늘려 그리므로(아래), 실제
  // 답변이 끊긴 지점은 늘리기 전 마지막 버킷의 endSec을 따로 기억해둬야 한다.
  const lastRealSec = computed(() => {
    const buckets = sortedBuckets.value
    return buckets.length ? buckets[buckets.length - 1].endSec : 0
  })
  const cutoffPct = computed(() => pcOfSec(lastRealSec.value))

  const tiltYBounds = computed(() => {
    const vals = sortedBuckets.value.map((b) => b.tiltPercent)
    if (!vals.length) return { lo: 0, hi: 1 }
    const lo = Math.max(0, Math.min(...vals) - 6)
    const hiRaw = Math.min(100, Math.max(...vals) + 6)
    return { lo, hi: hiRaw > lo ? hiRaw : lo + 1 }
  })
  const tiltYFor = (pct) => {
    const { lo, hi } = tiltYBounds.value
    return 100 - ((pct - lo) / (hi - lo)) * 100
  }
  // 그래프와 시선 이탈 마커가 서로 다른 계산식을 사용하면, 같은 시각인데도
  // 눈 아이콘이 선 위아래로 흩어져 보인다. 선과 마커가 함께 사용하는 동일한
  // 시간·기울기 좌표 목록을 먼저 만든다.
  const tiltPoints = computed(() => {
    const buckets = sortedBuckets.value
    const duration = safeDurationSec()
    if (!buckets.length) return []

    const points = buckets.map((bucket) => ({
      sec: Math.min(duration, Math.max(0, (Number(bucket.startSec) + Number(bucket.endSec)) / 2)),
      value: Number(bucket.tiltPercent) || 0,
    }))
    if (points.length === 1) {
      return [
        { sec: 0, value: points[0].value },
        { sec: duration, value: points[0].value },
      ]
    }
    points[0].sec = 0
    points[points.length - 1].sec = duration
    return points
  })
  const tiltValueAtSec = (sec) => {
    const points = tiltPoints.value
    if (!points.length) return 0
    const target = Math.min(safeDurationSec(), Math.max(0, Number(sec) || 0))
    const nextIndex = points.findIndex((point) => point.sec >= target)
    if (nextIndex <= 0) return points[0].value
    if (nextIndex === -1) return points[points.length - 1].value
    const previous = points[nextIndex - 1]
    const next = points[nextIndex]
    const span = Math.max(1e-6, next.sec - previous.sec)
    const ratio = (target - previous.sec) / span
    return previous.value + ((next.value - previous.value) * ratio)
  }
  const avgTiltPct = computed(() => {
    const buckets = sortedBuckets.value
    if (!buckets.length) return 0
    return Math.round(buckets.reduce((sum, b) => sum + b.tiltPercent, 0) / buckets.length)
  })
  // 음성 탭과 같은 자리(점선 왼쪽 끝 위)에 "기울기 평균 · N%"를 보여주기 위한
  // 대시선 위치 — useVoicePaceGraph의 avgLineStyle과 동일한 역할.
  const avgTiltLineStyle = computed(() => ({ '--avg-y': `${tiltYFor(avgTiltPct.value)}%` }))

  // 같은 좌표 목록을 직선으로 잇는다. 시선 이탈 마커도 아래의 동일한 선형
  // 보간값을 사용하므로 발생 시각과 관계없이 항상 그래프 선 위에 놓인다.
  const tiltLinePath = computed(() => {
    return tiltPoints.value.map((point, index) => (
      `${index ? 'L' : 'M'}${xForSec(point.sec)},${tiltYFor(point.value)}`
    )).join(' ')
  })

  // 시선 이탈 점도 추임새 점처럼 기울기 곡선 위에 앉혀서, 그 순간 기울기가
  // 어느 정도였는지까지 한눈에 보이게 한다.
  const gazeDotPositions = computed(() => (
    (seriesRef.value?.gazeEvents ?? []).map((e) => ({
      ...e,
      xPct: pcOfSec(e.atSec),
      yPct: tiltYFor(tiltValueAtSec(e.atSec)),
    }))
  ))

  return {
    chartEl,
    pcOfSec,
    tiltYBounds,
    tiltYFor,
    tiltValueAtSec,
    avgTiltPct,
    avgTiltLineStyle,
    tiltLinePath,
    gazeDotPositions,
    lastRealSec,
    cutoffPct,
  }
}
