/* 말하기 속도 표시 규칙 — 발표·면접 공통.
   숫자(WPM, 초당 음절)만 보여주면 "이게 빠른 건지 느린 건지" 알 수 없다는 QA
   피드백이 있었다. 그래서 화면에는 느림 / 보통 / 빠름으로 보여주고, 원래 숫자는
   보조 정보(툴팁 등)로만 남긴다.

   기준선은 두 단위 모두 '보통' 구간을 [slow, fast] 사이로 잡는다.
   - syllablesPerSecond(초당 음절): 실시간 Chrome STT는 문장 확정이 늦게 반영돼
     실제 발화보다 순간 측정값이 낮게 잡힌다. QA 실측값을 반영해 3~5.5음절/초를
     보통 구간으로 사용한다.
   - wpm(분당 어절): 서버의 10초 분석 결과와 기존 리포트 분포를 기준으로
     80~120어절/분을 쓴다.
     (예전 110~150은 리포트 목업의 권장 범위를 그대로 가져온 값이라 실제 측정값
      대부분이 '느림'으로 찍혔다 — 실측 평균은 80~100 WPM대였다.)
   백엔드가 값을 어떤 단위로 주는지에 따라 unit만 바꿔 쓰면 된다. */
export const SPEECH_PACE_BANDS = {
  wpm: { slow: 80, fast: 120 },
  syllablesPerSecond: { slow: 2.5, fast: 4 },
}

export const SPEECH_PACE_LABELS = {
  slow: '느림',
  normal: '보통',
  fast: '빠름',
}

/** @returns {'slow' | 'normal' | 'fast' | null} 값이 없으면 null */
export const speechPaceLevel = (value, unit = 'wpm') => {
  const band = SPEECH_PACE_BANDS[unit]
  const number = Number(value)
  if (!band || !Number.isFinite(number) || number <= 0) return null
  if (number < band.slow) return 'slow'
  if (number > band.fast) return 'fast'
  return 'normal'
}

/** 화면에 그대로 쓰는 라벨. 값이 없으면 fallback(기본 '--'). */
export const speechPaceLabel = (value, unit = 'wpm', fallback = '--') =>
  SPEECH_PACE_LABELS[speechPaceLevel(value, unit)] ?? fallback

/** 툴팁용 원래 숫자 설명 — 라벨만으로는 근거가 안 보이므로 함께 제공한다. */
export const speechPaceDetail = (value, unit = 'wpm') => {
  const level = speechPaceLevel(value, unit)
  if (!level) return '아직 측정된 말하기 속도가 없어요.'
  const band = SPEECH_PACE_BANDS[unit]
  const rounded = unit === 'wpm' ? Math.round(value) : Math.round(value * 10) / 10
  const suffix = unit === 'wpm' ? '분당 어절' : '초당 음절'
  return `${rounded} ${suffix} · 보통 구간 ${band.slow}~${band.fast}`
}
