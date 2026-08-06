// 발표 리포트의 슬라이드 분석 데이터를 면접 리포트 그래프 엔진
// (useVoicePaceGraph / useGestureGraph)이 받는 형태로 바꾼다.
//
// 두 화면의 그래프 디자인과 상호작용이 완전히 같아야 하므로 그리는 코드는 하나만
// 두고, 화면별로 다른 건 데이터 모양과 속도 단위(발표 WPM / 면접 초당 음절)뿐이다.

// 최저·최고 구간은 버킷 하나가 아니라 같은 값이 이어지는 구간 전체로 잡는다.
// (옆 10초가 시각적으로 같은 높이인데 표시가 안 되면 헷갈린다 — 면접 쪽과 동일 규칙)
const extremeRange = (buckets, isMoreExtreme) => {
  const extremeValue = buckets.reduce(
    (selected, bucket) => (isMoreExtreme(bucket.pace, selected) ? bucket.pace : selected),
    buckets[0].pace,
  )
  const startIndex = buckets.findIndex((bucket) => bucket.pace === extremeValue)
  let endIndex = startIndex
  while (endIndex + 1 < buckets.length && buckets[endIndex + 1].pace === extremeValue) endIndex += 1
  return {
    startSec: buckets[startIndex].startSec,
    endSec: buckets[endIndex].endSec,
    pace: extremeValue,
  }
}

// slide.speech(정규화된 발표 리포트) → useVoicePaceGraph 입력.
// 속도 단위는 WPM 그대로 두고(변환하지 않음), 표시 문구만 화면에서 WPM으로 쓴다.
export const toVoicePaceSeries = (speech) => {
  const sourceBuckets = speech?.buckets ?? []
  if (!sourceBuckets.length) return null

  const buckets = [...sourceBuckets]
    .map((bucket) => ({
      startSec: Number(bucket.startSec),
      endSec: Number(bucket.endSec),
      pace: Number(bucket.averageWpm) || 0,
    }))
    .sort((left, right) => left.startSec - right.startSec)

  // 평균 WPM은 응답에 있으면 그대로 쓰고, 없으면 구간 길이로 가중 평균한다.
  const explicitAverage = Number(speech.averageWpm)
  const measuredSec = buckets.reduce((total, bucket) => total + (bucket.endSec - bucket.startSec), 0)
  const avgPace = Number.isFinite(explicitAverage) && explicitAverage > 0
    ? explicitAverage
    : (measuredSec
        ? buckets.reduce((total, bucket) => (
            total + (bucket.pace * (bucket.endSec - bucket.startSec))
          ), 0) / measuredSec
        : 0)

  return {
    buckets,
    avgPace,
    slowest: extremeRange(buckets, (value, selected) => value < selected),
    fastest: extremeRange(buckets, (value, selected) => value > selected),
    fillerTotal: Number(speech.totalFillerCount) || 0,
    // 면접 엔진은 [단어, 횟수] 튜플 배열을 쓴다.
    fillerBreakdown: (speech.fillerBreakdown ?? []).map(({ word, count }) => [word, count]),
    fillerEvents: sourceBuckets.flatMap((bucket) => bucket.fillerEvents ?? []),
    longSilenceCount: Number(speech.silenceDetectedWindowCount) || 0,
    silences: sourceBuckets
      .filter((bucket) => bucket.silenceDetected)
      .map((bucket) => ({ startSec: Number(bucket.startSec), endSec: Number(bucket.endSec) })),
  }
}

// slide.gesture는 이미 useGestureGraph가 기대하는 모양
// ({ buckets: [{ startSec, endSec, tiltPercent }], gazeEvents: [{ atSec }], gazeCount })
// 이라 그대로 넘긴다. 버킷이 없으면 그래프를 그릴 수 없으므로 null로 통일한다.
export const toGestureSeries = (gesture) => (
  gesture?.buckets?.length ? gesture : null
)
