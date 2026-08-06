<script setup>
import { computed, ref } from 'vue'

import { useGestureGraph, formatTiltPercent } from '../../composables/useGestureGraph.js'
import { useVoicePaceGraph, toClock } from '../../composables/useVoicePaceGraph.js'
import { toGestureSeries, toVoicePaceSeries } from '../../utils/presentationReportGraphData.js'
import { formatCount, formatDecimal, formatWordsPerSecond } from '../../utils/displayFormatters.js'

// 그래프 디자인·상호작용은 면접 리포트와 같은 엔진(useVoicePaceGraph /
// useGestureGraph)과 같은 마크업(.iv-pace-*)을 쓴다. 발표는 속도 단위가 WPM이라
// 표시 문구와 y축 여유폭만 다르게 넘긴다.
const props = defineProps({
  slide: { type: Object, required: true },
  activeMetric: { type: String, default: 'voice' },
  activeLocalSec: { type: Number, default: 0 },
})
const emit = defineEmits(['update:activeMetric', 'seek-local'])

const WPM_Y_PADDING = 5
const formatWordsPerSecondRange = (lowerWpm, upperWpm) => {
  const lower = formatWordsPerSecond(lowerWpm)
  const upper = formatWordsPerSecond(upperWpm)
  if (lower === '-' || upper === '-') return '-'
  return `${lower}–${upper.replace('초당 ', '')} 측정 범위`
}
const formatWordsPerSecondValue = (value) => {
  const label = formatWordsPerSecond(value)
  return label === '-' ? label : label.replace('초당 ', '').replace('어절', '')
}

const durationSec = computed(() => Math.max(1, Number(props.slide.durationSec) || 0))
const voicePace = computed(() => toVoicePaceSeries(props.slide.speech))
const gestureSeries = computed(() => toGestureSeries(props.slide.gesture))

// 그래프의 x축·구간 데이터는 슬라이드마다 0에서 다시 시작하는 로컬 초다. 그대로
// 표시하면 슬라이드를 넘길 때마다 시계가 0:00으로 되돌아가 녹화 전체에서 언제였는지
// 알 수 없다 → 표시용 시각은 항상 슬라이드 시작 시각을 더한 녹화 기준 절대 초로
// 쓴다(1번 0:00–0:10, 2번 0:10–0:30, 3번 0:30–0:40처럼 이어진다).
const slideStartSec = computed(() => Math.max(0, Number(props.slide.startTimeSec) || 0))
const clockAt = (localSec) => toClock(slideStartSec.value + (Number(localSec) || 0))

// 빠르게 넘겨 발화가 아예 없는 슬라이드는 "데이터가 없습니다"가 아니라 왜 없는지를
// 알려준다(이동은 막지 않고 표시만 한다).
const isUnmeasured = computed(() => !(
  (props.slide?.transcriptSegments?.length ?? 0) > 0
  || (props.slide?.speech?.buckets?.length ?? 0) > 0
))
const UNMEASURED_NOTE = '이 슬라이드는 발화가 없어(빠르게 넘김) 분석할 수 없어요.'

const {
  paceChartEl,
  silenceSegments,
  paceChartPath,
  avgLineStyle,
  paceMarkers,
  paceYFor,
  paceYBounds,
  paceAtSec,
  fillerDotPositions,
  rangeOverlays,
  pcOfSec,
} = useVoicePaceGraph(voicePace, durationSec, { formatPace: formatWordsPerSecond, padding: WPM_Y_PADDING })

const {
  chartEl: gestureChartEl,
  tiltYBounds,
  tiltYFor,
  tiltValueAtSec,
  avgTiltPct,
  avgTiltLineStyle,
  tiltLinePath,
  gazeDotPositions,
} = useGestureGraph(gestureSeries, durationSec)

// 그래프 위 마우스 위치 안내(면접의 iv-pace-crosshair와 동일 동작).
const hoverPct = ref(null)
const hoverSec = ref(null)
const gestureHoverPct = ref(null)
const gestureHoverSec = ref(null)

const pointFromEvent = (element, event) => {
  const rect = element?.getBoundingClientRect()
  if (!rect?.width) return null
  const pct = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
  return { pct, sec: (pct / 100) * durationSec.value }
}
const onVoiceHover = (event) => {
  const point = pointFromEvent(paceChartEl.value, event)
  if (!point) return
  hoverPct.value = point.pct
  hoverSec.value = point.sec
}
const onVoiceHoverLeave = () => { hoverPct.value = null; hoverSec.value = null }
const onGestureHover = (event) => {
  const point = pointFromEvent(gestureChartEl.value, event)
  if (!point) return
  gestureHoverPct.value = point.pct
  gestureHoverSec.value = point.sec
}
const onGestureHoverLeave = () => { gestureHoverPct.value = null; gestureHoverSec.value = null }

const seek = (sec) => emit('seek-local', Math.max(0, Number(sec) || 0))
const seekFromChart = (element, event) => {
  const point = pointFromEvent(element, event)
  if (point) seek(point.sec)
}

// 재생 위치(검정 동그라미)를 잡아 끌어 이동 — 면접 리포트와 같은 조작.
// 포인터 캡처로 그래프 밖까지 끌어도 계속 따라온다.
const isDraggingPlayhead = ref(false)
const startPlayheadDrag = (element, event) => {
  event.stopPropagation()
  event.target.setPointerCapture?.(event.pointerId)
  isDraggingPlayhead.value = true
  seekFromChart(element, event)
}
const movePlayheadDrag = (element, event) => {
  if (!isDraggingPlayhead.value) return
  event.stopPropagation()
  seekFromChart(element, event)
}
const endPlayheadDrag = () => { isDraggingPlayhead.value = false }

// 재생 위치는 슬라이드 로컬 초 기준. 이 슬라이드 범위를 벗어나면 표시하지 않는다.
const localSec = computed(() => Number(props.activeLocalSec) || 0)
const playheadPct = computed(() => (
  localSec.value >= 0 && localSec.value <= durationSec.value ? pcOfSec(localSec.value) : null
))
const playheadYPct = computed(() => (
  playheadPct.value == null ? null : paceYFor(paceAtSec(localSec.value))
))
const gesturePlayheadYPct = computed(() => (
  playheadPct.value == null ? null : tiltYFor(tiltValueAtSec(localSec.value))
))

const slowMarker = computed(() => paceMarkers.value.find((marker) => marker.key === 'slow'))
const fastMarker = computed(() => paceMarkers.value.find((marker) => marker.key === 'fast'))
const fillerBreakdownLabel = computed(() => (
  (voicePace.value?.fillerBreakdown ?? [])
    .map(([word, count]) => `${word} ${formatCount(count, '0')}회`)
    .join(' · ')
))
</script>

<template>
  <section class="iv-metric-tabs" aria-label="슬라이드 음성 및 몸짓 분석">
    <div class="iv-metric-tabs-head">
      <div class="iv-metric-tabhead">
        <button
          type="button"
          class="iv-metric-tab"
          data-metric="voice"
          :class="{ 'is-active': activeMetric === 'voice' }"
          @click="emit('update:activeMetric', 'voice')"
        >음성</button>
        <button
          type="button"
          class="iv-metric-tab"
          data-metric="gesture"
          :class="{ 'is-active': activeMetric === 'gesture' }"
          @click="emit('update:activeMetric', 'gesture')"
        >몸짓</button>
        <span class="iv-metric-tab-question">슬라이드 {{ slide.slideNumber }}</span>
      </div>
      <div v-if="activeMetric === 'voice'" class="iv-pace-legend">
        <span class="iv-pace-legend-item is-slow"><i>▼</i>가장 느린 구간</span>
        <span class="iv-pace-legend-item is-fast"><i>▲</i>가장 빠른 구간</span>
        <span class="iv-pace-legend-item is-filler"><i></i><span class="iv-term-hint" tabindex="0">추임새<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span></span>
        <span class="iv-pace-legend-item is-silence"><i></i>침묵 구간</span>
      </div>
      <div v-else class="iv-pace-legend">
        <span class="iv-pace-legend-item is-gaze-dot"><i></i>시선 이탈</span>
        <span class="iv-pace-legend-item is-tilt-line"><i></i>기울기</span>
      </div>
    </div>

    <div v-if="activeMetric === 'voice' && voicePace" class="iv-pace-panel">
      <div class="iv-pace-meta iv-pace-meta-compact">
        <span class="iv-pace-meta-range">{{ formatWordsPerSecondRange(paceYBounds.lo, paceYBounds.hi) }}</span>
      </div>
      <div
        ref="paceChartEl"
        class="iv-pace-chart"
        @click="seekFromChart(paceChartEl, $event)"
        @pointermove="onVoiceHover"
        @pointerleave="onVoiceHoverLeave"
      >
        <div class="iv-pace-avg-line" :style="avgLineStyle">
          <span class="iv-pace-avg-label">평균 속도 · {{ formatWordsPerSecond(voicePace.avgPace) }}</span>
        </div>
        <span
          v-for="(silence, index) in silenceSegments"
          :key="`silence-${index}`"
          class="iv-pace-silence-bg"
          :style="{ left: `${silence.leftPct}%`, width: `${silence.widthPct}%` }"
          role="button"
          tabindex="0"
          :aria-label="`1초 이상 정적 ${clockAt(silence.startSec)}–${clockAt(silence.endSec)}`"
          @click.stop="seek(silence.startSec)"
        ></span>
        <svg class="iv-pace-svg" viewBox="0 0 600 100" preserveAspectRatio="none" aria-label="10초 구간별 초당 어절 수">
          <path :d="paceChartPath" class="iv-pace-step-line" />
        </svg>
        <div v-if="hoverPct != null && !isDraggingPlayhead" class="iv-pace-crosshair" :style="{ left: `${hoverPct}%` }" aria-hidden="true">
          <span class="iv-pace-crosshair-badge">{{ clockAt(hoverSec) }} · {{ formatWordsPerSecond(paceAtSec(hoverSec)) }}</span>
        </div>
        <div
          v-if="playheadPct != null"
          class="iv-pace-playhead"
          :style="{ left: `${playheadPct}%`, top: `${playheadYPct}%` }"
        >
          <span class="iv-pace-playhead-time">{{ clockAt(localSec) }}</span>
          <button
            type="button"
            class="iv-pace-playhead-dot"
            aria-label="재생 위치 드래그"
            @pointerdown="startPlayheadDrag(paceChartEl, $event)"
            @pointermove="movePlayheadDrag(paceChartEl, $event)"
            @pointerup="endPlayheadDrag"
            @pointercancel="endPlayheadDrag"
          ></button>
        </div>
        <button
          v-for="(filler, index) in fillerDotPositions"
          :key="`filler-${index}`"
          type="button"
          class="iv-pace-filler-dot"
          :data-filler-event="index"
          :style="{ left: `${filler.xPct}%`, top: `${filler.yPct}%` }"
          :aria-label="`추임새 '${filler.word}' ${clockAt(filler.atSec)} · 영상 이동`"
          @click.stop="seek(filler.atSec)"
        ></button>
      </div>
      <div class="iv-pace-range-lane" aria-label="발화 속도 구간">
        <button
          v-if="slowMarker"
          type="button"
          class="iv-pace-range-mark"
          :style="{ left: `${rangeOverlays.slow.leftPct}%`, width: `${rangeOverlays.slow.widthPct}%` }"
          :aria-label="`가장 느린 구간 ${clockAt(voicePace.slowest.startSec)}–${clockAt(voicePace.slowest.endSec)} · 영상 이동`"
          @click="seek(voicePace.slowest.startSec)"
        >
          <span class="iv-pace-range-icon">▼</span>
          <span class="iv-pace-range-bracket"></span>
          <span class="iv-pace-range-value">{{ formatWordsPerSecondValue(voicePace.slowest.pace) }}</span>
        </button>
        <button
          v-if="fastMarker"
          type="button"
          class="iv-pace-range-mark"
          :style="{ left: `${rangeOverlays.fast.leftPct}%`, width: `${rangeOverlays.fast.widthPct}%` }"
          :aria-label="`가장 빠른 구간 ${clockAt(voicePace.fastest.startSec)}–${clockAt(voicePace.fastest.endSec)} · 영상 이동`"
          @click="seek(voicePace.fastest.startSec)"
        >
          <span class="iv-pace-range-icon">▲</span>
          <span class="iv-pace-range-bracket"></span>
          <span class="iv-pace-range-value">{{ formatWordsPerSecondValue(voicePace.fastest.pace) }}</span>
        </button>
      </div>
      <div class="iv-pace-axis-edges">
        <span>{{ clockAt(0) }}</span>
        <span>{{ clockAt(durationSec) }}</span>
      </div>
      <div class="iv-pace-chips">
        <span class="iv-pace-chip is-filler"><span class="iv-term-hint" tabindex="0">추임새<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span> {{ formatCount(voicePace.fillerTotal, '0') }}회<small v-if="fillerBreakdownLabel" data-filler-breakdown>{{ fillerBreakdownLabel }}</small></span>
        <span class="iv-pace-chip is-silence">1초 이상 정적 {{ formatCount(voicePace.longSilenceCount, '0') }}회</span>
        <span v-if="slowMarker" class="iv-pace-chip is-slow">▼ 가장 느린 구간 {{ slowMarker.pace }}<small>{{ clockAt(voicePace.slowest.startSec) }}–{{ clockAt(voicePace.slowest.endSec) }}</small></span>
        <span v-if="fastMarker" class="iv-pace-chip is-fast">▲ 가장 빠른 구간 {{ fastMarker.pace }}<small>{{ clockAt(voicePace.fastest.startSec) }}–{{ clockAt(voicePace.fastest.endSec) }}</small></span>
      </div>
    </div>
    <div v-else-if="activeMetric === 'voice'" class="iv-metric-empty pr-data-empty" :class="{ 'is-unmeasured': isUnmeasured }">
      {{ isUnmeasured ? UNMEASURED_NOTE : '이 슬라이드의 음성 분석 데이터가 없습니다.' }}
    </div>

    <div v-else-if="gestureSeries" class="iv-video-panel">
      <div class="iv-pace-panel">
        <div class="iv-pace-meta iv-pace-meta-compact">
          <span class="iv-pace-meta-range">{{ tiltYBounds.lo.toFixed(0) }}–{{ tiltYBounds.hi.toFixed(0) }}% 범위</span>
        </div>
        <div
          ref="gestureChartEl"
          class="iv-pace-chart"
          @click="seekFromChart(gestureChartEl, $event)"
          @pointermove="onGestureHover"
          @pointerleave="onGestureHoverLeave"
        >
          <div class="iv-pace-avg-line" :style="avgTiltLineStyle">
            <span class="iv-pace-avg-label">기울기 평균 · {{ avgTiltPct }}%</span>
          </div>
          <svg class="iv-pace-svg" viewBox="0 0 600 100" preserveAspectRatio="none" aria-label="10초 구간별 자세 기울기">
            <path :d="tiltLinePath" class="iv-gesture-line is-tilt" />
          </svg>
          <div
            v-if="gestureHoverPct != null"
            class="iv-pace-crosshair"
            :style="{ left: `${gestureHoverPct}%` }"
            aria-hidden="true"
          >
            <span class="iv-pace-crosshair-badge">{{ clockAt(gestureHoverSec) }} · 기울기 {{ formatTiltPercent(tiltValueAtSec(gestureHoverSec)) }}%</span>
          </div>
          <button
            v-for="(dot, index) in gazeDotPositions"
            :key="`gaze-${index}`"
            type="button"
            class="iv-gesture-gaze-dot"
            :style="{ left: `${dot.xPct}%`, top: `${dot.yPct}%` }"
            :aria-label="`시선 이탈 ${clockAt(dot.atSec)} · 영상 이동`"
            @click.stop="seek(dot.atSec)"
          >
            <svg viewBox="0 0 20 14" class="iv-gesture-eye-svg" aria-hidden="true">
              <path d="M1,7 C4,1 16,1 19,7 C16,13 4,13 1,7 Z" class="iv-gesture-eye-outline" />
              <circle cx="10" cy="7" r="3" class="iv-gesture-eye-pupil" />
            </svg>
          </button>
          <div
            v-if="playheadPct != null"
            class="iv-pace-playhead"
            :style="{ left: `${playheadPct}%`, top: `${gesturePlayheadYPct}%` }"
          >
            <span class="iv-pace-playhead-time">{{ clockAt(localSec) }}</span>
            <button
              type="button"
              class="iv-pace-playhead-dot"
              aria-label="재생 위치 드래그"
              @pointerdown="startPlayheadDrag(gestureChartEl, $event)"
              @pointermove="movePlayheadDrag(gestureChartEl, $event)"
              @pointerup="endPlayheadDrag"
              @pointercancel="endPlayheadDrag"
            ></button>
          </div>
        </div>
        <div class="iv-pace-axis-edges">
          <span>{{ clockAt(0) }}</span>
          <span>{{ clockAt(durationSec) }}</span>
        </div>
      </div>

      <div class="iv-pace-chips">
        <span class="iv-pace-chip is-gaze">시선 이탈 {{ formatCount(gestureSeries.gazeCount, '0') }}회</span>
        <span class="iv-pace-chip is-tilt">기울기 평균 {{ formatDecimal(avgTiltPct, { minimum: 0, maximum: 100 }) }}%</span>
      </div>
    </div>
    <div v-else data-gesture-empty class="iv-metric-empty pr-data-empty" :class="{ 'is-unmeasured': isUnmeasured }">
      {{ isUnmeasured ? UNMEASURED_NOTE : '이 슬라이드의 몸짓 분석 데이터가 없습니다.' }}
    </div>
  </section>
</template>
