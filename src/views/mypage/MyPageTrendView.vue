<script setup>
import { computed, onMounted, ref } from 'vue'

import { userApi } from '../../api/userApi.js'
import { normalizePracticeTrends } from '../../api/normalizers/trends.js'
import { formatScore } from '../../utils/displayFormatters.js'

const COPY = {
  title: '\uB0B4 \uD559\uC2B5 \uCD94\uC774',
  intro: '\uC644\uB8CC\uD55C \uC5F0\uC2B5 \uAE30\uB85D\uC744 \uBE44\uAD50\uD574 \uBC18\uBCF5\uB418\uB294 \uBCC0\uD654\uB97C \uC815\uB9AC\uD588\uC5B4\uC694.',
  loading: '\uD559\uC2B5 \uCD94\uC774\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC774\uC5D0\uC694.',
  error: '\uD559\uC2B5 \uCD94\uC774\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.',
  errorDetail: '\uAC00\uC838\uC62C \uC218 \uC5C6\uB294 \uC815\uBCF4\uB294 \uBE44\uC6CC \uB450\uACE0 \uD45C\uC2DC\uD588\uC5B4\uC694.',
  retry: '\uB2E4\uC2DC \uC2DC\uB3C4',
  empty: '\uC544\uC9C1 \uBD84\uC11D\uD560 \uC5F0\uC2B5 \uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694.',
  noScoreHistory: '\uC544\uC9C1 \uD45C\uC2DC\uD560 \uC5F0\uC2B5 \uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694.',
  metricsTitle: '\uD575\uC2EC \uC9C0\uD45C',
  insufficient: '\uC774\uC804 \uAE30\uB85D\uC774 \uBD80\uC871\uD574\uC694',
  analysis: '\uD559\uC2B5 \uBD84\uC11D',
  insightTitle: '\uAC15\uC810\uACFC \uC57D\uC810',
  strengths: '\uB098\uC758 \uAC15\uC810',
  weaknesses: '\uAC1C\uC120\uC774 \uD544\uC694\uD55C \uBD80\uBD84',
  noStrengths: '\uBE44\uAD50\uD560 \uC774\uC804 \uAE30\uB85D\uC774 \uC313\uC774\uBA74 \uAC15\uC810\uC744 \uC54C\uB824\uB4DC\uB824\uC694.',
  noWeaknesses: '\uBE44\uAD50\uD560 \uC774\uC804 \uAE30\uB85D\uC774 \uC313\uC774\uBA74 \uAC1C\uC120 \uC9C0\uD45C\uB97C \uC54C\uB824\uB4DC\uB824\uC694.',
  speechTitle: '\uBC1C\uD45C \uD750\uB984',
  averageSpeechSpeed: '\uD3C9\uADE0 \uBC1C\uD654 \uC18D\uB3C4',
  reference: '\uCC38\uACE0 \uC9C0\uD45C',
  earlyLateSpeed: '\uCD08\uBC18 / \uD6C4\uBC18 \uC18D\uB3C4',
  earlyLateDescription: '\uC5F0\uC2B5 \uC55E 30%\uC640 \uB4A4 30%',
  lateChange: '\uD6C4\uBC18\uBD80 \uC18D\uB3C4 \uBCC0\uD654',
  earlyAverage: '\uCD08\uBC18 \uD3C9\uADE0 \uB300\uBE44',
  silenceRatio: '\uCE68\uBB35 \uBE44\uC728',
  silenceDescription: '\uBD84\uC11D\uB41C \uC804\uCCB4 \uAD6C\uAC04 \uAE30\uC900',
  trendLabel: '\uC9C0\uD45C \uCD94\uC774',
  change: '\uBCC0\uD654',
  selectorLabel: '\uCD94\uC774 \uC810\uC218 \uC120\uD0DD',
  chartLabel: '\uC810\uC218 \uCD94\uC774',
  nextGoal: '\uB2E4\uC74C \uC5F0\uC2B5 \uCD94\uCC9C \uBAA9\uD45C',
}

const INSIGHT_COPY = {
  content: {
    positive: '\uC2AC\uB77C\uC774\uB4DC \uB0B4\uC6A9 \uC804\uB2EC \uC810\uC218\uAC00 \uC774\uC804 3\uD68C\uBCF4\uB2E4 \uB192\uC544\uC84C\uC5B4\uC694.',
    negative: '\uC2AC\uB77C\uC774\uB4DC \uD575\uC2EC \uB0B4\uC6A9\uC744 \uBE60\uC9D0\uC5C6\uC774 \uC124\uBA85\uD558\uB294 \uC5F0\uC2B5\uC774 \uD544\uC694\uD574\uC694.',
  },
  stability: {
    positive: '\uC790\uC138 \uC548\uC815\uB3C4\uAC00 \uC774\uC804 3\uD68C\uBCF4\uB2E4 \uB192\uC544\uC84C\uC5B4\uC694.',
    negative: '\uCE74\uBA54\uB77C \uC548\uC5D0\uC11C \uC0C1\uCCB4 \uC704\uCE58\uB97C \uC77C\uC815\uD558\uAC8C \uC720\uC9C0\uD574 \uBCF4\uC138\uC694.',
  },
  glance: {
    positive: '\uBD84\uB2F9 \uC2DC\uC120 \uC774\uD0C8 \uD69F\uC218\uAC00 \uC774\uC804 3\uD68C\uBCF4\uB2E4 \uC904\uC5C8\uC5B4\uC694.',
    negative: '\uD654\uBA74 \uC678\uBD80\uB85C \uC2DC\uC120\uC774 \uBC97\uC5B4\uB098\uB294 \uD69F\uC218\uB97C \uC904\uC5EC \uBCF4\uC138\uC694.',
  },
  filler: {
    positive: '\uBD84\uB2F9 \uD544\uB7EC \uC0AC\uC6A9\uC774 \uC774\uC804 3\uD68C\uBCF4\uB2E4 \uC904\uC5C8\uC5B4\uC694.',
    negative: '\uBB38\uC7A5 \uC2DC\uC791 \uC804\uC5D0 \uC9E7\uAC8C \uC228\uC744 \uACE0\uB974\uBA70 \uD544\uB7EC \uC0AC\uC6A9\uC744 \uC904\uC5EC \uBCF4\uC138\uC694.',
  },
  speed: {
    positive: '\uAD6C\uAC04\uBCC4 \uBC1C\uD654 \uC18D\uB3C4 \uCC28\uC774\uAC00 \uC774\uC804 3\uD68C\uBCF4\uB2E4 \uC904\uC5C8\uC5B4\uC694.',
    negative: '\uAD6C\uAC04\uBCC4 \uBC1C\uD654 \uC18D\uB3C4 \uCC28\uC774\uAC00 \uCEE4\uC84C\uC5B4\uC694. \uBB38\uC7A5 \uB05D\uC5D0\uC11C \uD638\uD761\uC744 \uC815\uB9AC\uD574 \uBCF4\uC138\uC694.',
  },
  totalTime: {
    positive: '\uBAA9\uD45C \uC2DC\uAC04\uACFC \uC2E4\uC81C \uC5F0\uC2B5 \uC2DC\uAC04\uC758 \uCC28\uC774\uAC00 \uC904\uC5C8\uC5B4\uC694.',
    negative: '\uC2AC\uB77C\uC774\uB4DC\uBCC4 \uBC30\uBD84 \uC2DC\uAC04\uC744 \uC815\uD574 \uBAA9\uD45C \uC2DC\uAC04 \uC624\uCC28\uB97C \uC904\uC5EC \uBCF4\uC138\uC694.',
  },
}

// 안내 문구에서 약속하는 최소 연습 횟수. 실제로 비교 지표가 열리는 시점은 서버가
// 이전 구간(earlyTrend/lateTrend)을 내려주는지에 달려 있고, 아직 못 내려준 동안은
// "이전 기록을 집계하는 중이에요" 상태로 안내한다.
const TREND_MIN_PRACTICES = 2

const ONBOARDING_COPY = {
  emptyTitle: '아직 분석할 연습 기록이 없어요',
  emptyCopy: `발표나 면접 연습을 마치면 여기에 기록이 쌓여요. ${TREND_MIN_PRACTICES}회가 모이면 이전 기록과 비교한 변화를 정리해드려요.`,
  aggregatingTitle: '이전 기록을 집계하는 중이에요',
  aggregatingCopy: '연습 횟수는 충분해요. 이전 구간 집계가 준비되면 비교 지표를 바로 보여드려요.',
  progressCopy: `연습 ${TREND_MIN_PRACTICES}회가 모이면 이전 기록과 최근 기록을 비교해 강점과 약점을 정리해드려요.`,
  cta: '연습 시작하기',
  locked: `연습 ${TREND_MIN_PRACTICES}회부터 비교 지표가 열려요`,
}

const loading = ref(true)
const loadError = ref(false)
const trend = ref(null)
const selectedSeriesKey = ref('content')

const loadTrends = async () => {
  loading.value = true
  loadError.value = false
  try {
    trend.value = normalizePracticeTrends(await userApi.getPracticeTrends())
  } catch {
    trend.value = normalizePracticeTrends({})
    loadError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadTrends)

const metrics = computed(() => trend.value?.metrics ?? [])
const scoreSeries = computed(() => trend.value?.scoreSeries ?? [])
const selectedSeries = computed(
  () => scoreSeries.value.find(({ key }) => key === selectedSeriesKey.value) ?? scoreSeries.value[0] ?? null,
)
const comparisonCopy = computed(() => trend.value?.hasPreviousData
  ? `${trend.value.recentLabel}\uC640 ${trend.value.previousLabel}\uB97C \uBE44\uAD50\uD588\uC5B4\uC694`
  // \uC544\uC9C1 \uBE44\uAD50\uAC00 \uBD88\uAC00\uB2A5\uD55C\uB370 "\uBE44\uAD50\uD588\uC5B4\uC694"\uB77C\uACE0 \uC4F0\uBA74 \uC65C \uAC12\uC774 \uC5C6\uB294\uC9C0 \uC54C \uC218 \uC5C6\uB2E4.
  : ONBOARDING_COPY.locked)
const dashboardIntro = computed(() => trend.value?.hasPreviousData
  ? `${trend.value.recentLabel}\uC640 ${trend.value.previousLabel}\uB97C \uBE44\uAD50\uD574 \uBC18\uBCF5\uB418\uB294 \uBCC0\uD654\uB97C \uC815\uB9AC\uD588\uC5B4\uC694.`
  : COPY.intro)
const insightCopy = computed(() => trend.value?.hasPreviousData
  ? `${trend.value.previousLabel}\uBCF4\uB2E4 \uC88B\uC544\uC9C4 \uC9C0\uD45C\uC640 \uC6B0\uC120 \uAC1C\uC120\uD560 \uC9C0\uD45C\uB97C \uC815\uB9AC\uD588\uC5B4\uC694.`
  : '\uC774\uC804 \uAE30\uB85D\uBCF4\uB2E4 \uC88B\uC544\uC9C4 \uC9C0\uD45C\uC640 \uC6B0\uC120 \uAC1C\uC120\uD560 \uC9C0\uD45C\uB97C \uC815\uB9AC\uD588\uC5B4\uC694.')

// \uBE44\uAD50 \uC9C0\uD45C\uAC00 \uC5F4\uB9AC\uAE30 \uC804 \uC0C1\uD0DC \u2014 \uBA87 \uD68C\uAC00 \uB0A8\uC558\uB294\uC9C0\uC640 \uC9C0\uAE08\uAE4C\uC9C0\uC758 \uAE30\uB85D\uC744 \uBCF4\uC5EC\uC900\uB2E4.
const practiceCount = computed(() => trend.value?.practices.length ?? 0)
const remainingPractices = computed(() => Math.max(0, TREND_MIN_PRACTICES - practiceCount.value))
const onboardingTitle = computed(() => {
  if (!practiceCount.value) return ONBOARDING_COPY.emptyTitle
  if (!remainingPractices.value) return ONBOARDING_COPY.aggregatingTitle
  return `\uCD94\uC774 \uBE44\uAD50\uAE4C\uC9C0 ${remainingPractices.value}\uD68C \uB0A8\uC558\uC5B4\uC694`
})
const onboardingCopy = computed(() => {
  if (!practiceCount.value) return ONBOARDING_COPY.emptyCopy
  if (!remainingPractices.value) return ONBOARDING_COPY.aggregatingCopy
  return ONBOARDING_COPY.progressCopy
})
const metricInsightDescription = (metric, tone) => {
  const description = INSIGHT_COPY[metric.key]?.[tone]
  return description?.replace('\uC774\uC804 3\uD68C', trend.value?.previousLabel ?? '\uC774\uC804 \uAE30\uB85D') ?? metric.deltaLabel
}
// practices\uB294 \uC624\uB798\uB41C \uC21C\uC73C\uB85C \uC624\uACE0 \uBE44\uAD50 \uC804 \uAD6C\uAC04\uC5D0\uC11C\uB294 \uC804\uCCB4 \uAE30\uB85D\uC774\uBBC0\uB85C index+1 = \uD68C\uCC28.
const strengths = computed(() => (trend.value?.hasPreviousData ? metrics.value : [])
  .filter(({ tone }) => tone === 'positive')
  .slice(0, 3)
  .map((metric) => ({ label: metric.label, description: metricInsightDescription(metric, 'positive') })))
const weaknesses = computed(() => (trend.value?.hasPreviousData ? metrics.value : [])
  .filter(({ tone }) => tone === 'negative')
  .slice(0, 3)
  .map((metric) => ({ label: metric.label, description: metricInsightDescription(metric, 'negative') })))
const nextGoal = computed(() => {
  if (!trend.value?.hasPreviousData) return null
  const metric = metrics.value.find(({ tone }) => tone === 'negative')
  if (!metric) return null
  return {
    title: `${metric.label} \uC9C0\uD45C\uB97C \uBA3C\uC800 \uAC1C\uC120\uD574 \uBCF4\uC138\uC694.`,
    description: metricInsightDescription(metric, 'negative'),
  }
})

const metricSpark = (metric) => [metric.previousValue, metric.value].filter((value) => value != null)
const sparkHeight = (values, value) => {
  if (!values.length) return '28%'
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum || 1
  return `${32 + ((value - minimum) / range) * 60}%`
}

const CHART_TOP = 30
const CHART_BOTTOM = 180
const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP
const CHART_AXIS_TICKS = [100, 75, 50, 25, 0].map((value) => ({
  value,
  y: CHART_BOTTOM - (value / 100) * CHART_HEIGHT,
}))

const chartPoints = computed(() => {
  const values = selectedSeries.value?.values ?? []
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (!finiteValues.length) return []

  const previousCount = trend.value?.previousCount ?? 0
  const recentCount = trend.value?.recentCount ?? Math.min(3, values.length)

  return values.map((value, index) => {
    if (!Number.isFinite(value)) return null
    const belongsToRecent = index >= previousCount
    const slot = trend.value?.hasPreviousData
      ? (belongsToRecent ? 3 + (index - previousCount) : 3 - previousCount + index)
      : 6 - recentCount + index
    return {
      index,
      value,
      x: 65 + slot * 96,
      y: CHART_BOTTOM - (Math.min(100, Math.max(0, value)) / 100) * CHART_HEIGHT,
      isRecent: trend.value?.hasPreviousData ? belongsToRecent : true,
    }
  }).filter(Boolean)
})

const previousChartPoints = computed(() => chartPoints.value.filter(({ isRecent }) => !isRecent))
const recentChartPoints = computed(() => chartPoints.value.filter(({ isRecent }) => isRecent))
const toPolyline = (points) => points.map(({ x, y }) => `${x},${y}`).join(' ')
const chartConnector = computed(() => {
  const previous = previousChartPoints.value.at(-1)
  const recent = recentChartPoints.value[0]
  return previous && recent ? { previous, recent } : null
})
</script>

<template>
  <section class="mypage-panel trend-dashboard">
    <header class="trend-dashboard-head">
      <div>
        <h2>{{ COPY.title }}</h2>
        <p>{{ dashboardIntro }}</p>
      </div>
    </header>

    <div v-if="loading" class="trend-state" data-testid="trend-loading">
      {{ COPY.loading }}
    </div>
    <div v-if="!loading && loadError" class="trend-warning" data-testid="trend-warning">
      <div>
        <strong>{{ COPY.error }}</strong>
        <p>{{ COPY.errorDetail }}</p>
      </div>
      <button type="button" data-testid="trend-retry" @click="loadTrends">{{ COPY.retry }}</button>
    </div>

    <template v-if="!loading && trend">
      <!-- 비교가 불가능한 동안은 별도 카드로 설명하지 않고, 지표 전체를 흐리게
           깔고 그 위에 안내 + 연습하러 가기만 띄운다(빈 카드가 하나 더 생기지
           않도록). -->
      <div class="trend-body" :class="{ 'is-locked': !trend.hasPreviousData }">
        <div
          v-if="!trend.hasPreviousData"
          class="trend-lock"
          data-testid="trend-onboarding"
          aria-labelledby="trendOnboardingTitle"
        >
          <div class="trend-lock-card">
            <h3 id="trendOnboardingTitle">{{ onboardingTitle }}</h3>
            <p>{{ onboardingCopy }}</p>
            <RouterLink to="/practice" class="trend-onboarding-cta">{{ ONBOARDING_COPY.cta }}</RouterLink>
          </div>
        </div>

      <div class="trend-body-inner" :aria-hidden="!trend.hasPreviousData || undefined">
      <section class="trend-section trend-metric-section">
        <div class="trend-section-head">
          <div>
            <h3>{{ COPY.metricsTitle }}</h3>
            <p>{{ comparisonCopy }}</p>
          </div>
        </div>

        <div class="trend-metric-grid">
          <article
            v-for="metric in metrics"
            :key="metric.key"
            data-testid="core-metric-card"
            :class="['trend-metric-card', { 'is-unavailable': metric.value == null }]"
          >
            <div class="trend-metric-card-head">
              <span>{{ metric.label }}</span>
              <div v-if="metricSpark(metric).length" class="trend-spark" aria-hidden="true">
                <i
                  v-for="(point, index) in metricSpark(metric)"
                  :key="`${metric.key}-${index}`"
                  :style="{ height: sparkHeight(metricSpark(metric), point) }"
                />
              </div>
            </div>
            <strong>{{ metric.displayValue }}<small v-if="metric.value != null">{{ metric.unit }}</small></strong>
            <span v-if="trend.hasPreviousData && metric.deltaLabel" :class="['metric-delta', `is-${metric.tone}`]">
              {{ metric.deltaLabel }}
            </span>
            <span v-else class="metric-delta is-disabled">{{ COPY.insufficient }}</span>
          </article>
        </div>
      </section>

      <section class="trend-section trend-insight-section">
        <div class="trend-section-head">
          <div>
            <span class="trend-section-label">{{ COPY.analysis }}</span>
            <h3>{{ COPY.insightTitle }}</h3>
            <p>{{ insightCopy }}</p>
          </div>
        </div>

        <div class="trend-insight-grid">
          <article :class="['trend-insight-card', 'is-strength', { 'is-unavailable': !trend.hasPreviousData }]">
            <div class="trend-insight-title">
              <span aria-hidden="true">&#10003;</span>
              <div><small>STRENGTH</small><h4>{{ COPY.strengths }}</h4></div>
            </div>
            <ul v-if="strengths.length">
              <li v-for="item in strengths" :key="item.label">
                <strong>{{ item.label }}</strong>
                <p>{{ item.description }}</p>
              </li>
            </ul>
            <p v-else class="trend-empty-copy">{{ COPY.noStrengths }}</p>
          </article>

          <article :class="['trend-insight-card', 'is-weakness', { 'is-unavailable': !trend.hasPreviousData }]">
            <div class="trend-insight-title">
              <span aria-hidden="true">!</span>
              <div><small>FOCUS</small><h4>{{ COPY.weaknesses }}</h4></div>
            </div>
            <ul v-if="weaknesses.length">
              <li v-for="item in weaknesses" :key="item.label">
                <strong>{{ item.label }}</strong>
                <p>{{ item.description }}</p>
              </li>
            </ul>
            <p v-else class="trend-empty-copy">{{ COPY.noWeaknesses }}</p>
          </article>
        </div>
      </section>

      <section class="trend-section">
        <div class="trend-section-head"><h3>{{ COPY.speechTitle }}</h3></div>
        <div class="trend-reference-grid">
          <article
            data-testid="speech-reference-card"
            :class="['trend-reference-card', { 'is-unavailable': trend.speechReference.averageWpm === '-' }]"
          >
            <span>{{ COPY.averageSpeechSpeed }}</span>
            <strong data-testid="average-wpm">{{ trend.speechReference.averageWpm }}</strong>
            <small>{{ COPY.reference }}</small>
          </article>
          <article
            data-testid="speech-reference-card"
            :class="['trend-reference-card', { 'is-unavailable': trend.speechReference.earlyWpm === '-' || trend.speechReference.lateWpm === '-' }]"
          >
            <span>{{ COPY.earlyLateSpeed }}</span>
            <strong>{{ trend.speechReference.earlyWpm }} <em>&rarr;</em> {{ trend.speechReference.lateWpm }}</strong>
            <small>{{ COPY.earlyLateDescription }}</small>
          </article>
          <article
            data-testid="speech-reference-card"
            :class="['trend-reference-card', { 'is-unavailable': trend.speechReference.lateChange === '-' }]"
          >
            <span>{{ COPY.lateChange }}</span>
            <strong>{{ trend.speechReference.lateChange }}</strong>
            <small>{{ COPY.earlyAverage }}</small>
          </article>
          <article
            data-testid="speech-reference-card"
            :class="['trend-reference-card', { 'is-unavailable': trend.speechReference.silenceRatio === '-' }]"
          >
            <span>{{ COPY.silenceRatio }}</span>
            <strong>{{ trend.speechReference.silenceRatio }}</strong>
            <small>{{ COPY.silenceDescription }}</small>
          </article>
        </div>
      </section>

      <section class="trend-section">
        <div class="trend-section-head trend-chart-head">
          <div>
            <span class="trend-section-label">{{ COPY.trendLabel }}</span>
            <h3>{{ selectedSeries?.label }} {{ COPY.change }}</h3>
          </div>
          <div class="trend-metric-selector" role="group" :aria-label="COPY.selectorLabel">
            <button
              v-for="series in scoreSeries"
              :key="series.key"
              type="button"
              data-testid="score-series-button"
              :class="{ active: selectedSeries?.key === series.key }"
              @click="selectedSeriesKey = series.key"
            >
              {{ series.label }}
            </button>
          </div>
        </div>

        <div class="trend-history-chart">
          <div
            v-if="!trend.hasPreviousData"
            data-testid="score-history-unavailable"
            :class="['trend-history-missing', 'is-disabled', { 'is-full': !trend.practices.length }]"
          >
            {{ trend.practices.length ? COPY.insufficient : COPY.noScoreHistory }}
          </div>
          <svg viewBox="0 0 600 210" preserveAspectRatio="none" role="img" :aria-label="COPY.chartLabel">
            <g v-for="tick in CHART_AXIS_TICKS" :key="`axis-${tick.value}`">
              <line x1="65" :y1="tick.y" x2="545" :y2="tick.y" class="trend-chart-guide" />
              <text
                x="48"
                :y="tick.y + 4"
                data-testid="chart-axis-label"
                class="trend-chart-axis-label"
                text-anchor="end"
              >{{ tick.value }}</text>
            </g>
            <line x1="305" y1="30" x2="305" y2="180" class="trend-chart-divider" />
            <polyline v-if="previousChartPoints.length" :points="toPolyline(previousChartPoints)" class="trend-chart-line is-previous" />
            <line
              v-if="chartConnector"
              :x1="chartConnector.previous.x"
              :y1="chartConnector.previous.y"
              :x2="chartConnector.recent.x"
              :y2="chartConnector.recent.y"
              class="trend-chart-connector"
            />
            <polyline v-if="recentChartPoints.length" :points="toPolyline(recentChartPoints)" class="trend-chart-line is-recent" />
            <circle
              v-for="point in chartPoints"
              :key="`dot-${point.index}`"
              :cx="point.x"
              :cy="point.y"
              r="6"
              :class="['trend-chart-dot', point.isRecent ? 'is-recent' : 'is-previous']"
            />
            <text
              v-for="point in chartPoints"
              :key="`value-${point.index}`"
              data-testid="chart-point-value"
              :x="point.x"
              :y="point.y - 13"
              class="trend-chart-value"
              text-anchor="middle"
            >{{ formatScore(point.value) }}{{ '\uC810' }}</text>
          </svg>
          <div class="trend-chart-groups">
            <span :class="{ 'is-disabled': !trend.hasPreviousData }">{{ trend.previousLabel }}</span>
            <span>{{ trend.recentLabel }}</span>
          </div>
        </div>
      </section>

      <section v-if="nextGoal" class="trend-next-goal" :aria-label="COPY.nextGoal">
        <span class="trend-goal-icon" aria-hidden="true">&nearr;</span>
        <div>
          <span class="trend-section-label">{{ COPY.nextGoal }}</span>
          <h3>{{ nextGoal.title }}</h3>
          <p>{{ nextGoal.description }}</p>
        </div>
      </section>
      <section v-else class="trend-next-goal is-unavailable" :aria-label="COPY.nextGoal">
        <span class="trend-goal-icon" aria-hidden="true">&nearr;</span>
        <div>
          <span class="trend-section-label">{{ COPY.nextGoal }}</span>
          <p>{{ COPY.insufficient }}</p>
        </div>
      </section>
      </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.trend-dashboard {
  --trend-blue: #5d70dc;
  --trend-blue-soft: #eef1ff;
  --trend-ink: #202a49;
  --trend-muted: #7f899f;
  --trend-line: #e5e8f1;
  color: var(--trend-ink);
}

.trend-dashboard-head,
.trend-section-head,
.trend-insight-title,
.trend-next-goal {
  display: flex;
  align-items: center;
}

.trend-dashboard-head {
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
}

.trend-dashboard-head h2 {
  margin: 0;
  font-size: 31px;
  line-height: 1.38;
  letter-spacing: -.035em;
}

.trend-dashboard-head p,
.trend-section-head p,
.trend-next-goal p {
  margin: 6px 0 0;
  color: var(--trend-muted);
  font-size: 13px;
  line-height: 1.6;
}

.trend-section-label {
  color: var(--trend-blue);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .08em;
}

.trend-state {
  display: grid;
  min-height: 250px;
  place-items: center;
  padding: 40px;
  border: 1px solid var(--trend-line);
  border-radius: 18px;
  background: #fafbfe;
  color: var(--trend-muted);
  text-align: center;
}

.trend-state p { margin: 0; }

.trend-state button {
  margin-top: 14px;
  padding: 10px 18px;
  border: 0;
  border-radius: 10px;
  background: var(--trend-blue);
  color: #fff;
  font-weight: 800;
  cursor: pointer;
}

.trend-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
  padding: 14px 16px;
  border: 1px dashed #cfd4df;
  border-radius: 12px;
  background: #f4f5f7;
  color: #7e8798;
}

.trend-warning strong { color: #666f80; font-size: 13px; }
.trend-warning p { margin: 3px 0 0; font-size: 11px; }
.trend-warning button {
  flex: 0 0 auto;
  padding: 8px 13px;
  border: 1px solid #c9ced9;
  border-radius: 8px;
  background: #fff;
  color: #687184;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

/* 비교가 열리기 전: 지표 전체를 흐리게 깔고 그 위에 안내 + 연습하러 가기만 띄운다.
   (빈 카드를 하나 더 만들지 않고, 무엇이 열릴 예정인지 실루엣으로 보이게 한다.) */
.trend-body { position: relative; }

.trend-body.is-locked .trend-body-inner {
  filter: blur(5px) saturate(.7);
  opacity: .5;
  pointer-events: none;
  user-select: none;
}

.trend-lock {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: clamp(40px, 12%, 130px);
}

.trend-lock-card {
  display: grid;
  justify-items: center;
  gap: 10px;
  max-width: 460px;
  padding: 26px 30px;
  border: 1px solid #dde4fb;
  border-radius: 16px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 18px 44px rgba(32, 42, 73, .12);
  text-align: center;
}

.trend-lock-card h3 { margin: 0; font-size: 19px; letter-spacing: -.02em; }

.trend-lock-card p {
  margin: 0;
  color: var(--trend-muted);
  font-size: 13px;
  line-height: 1.65;
}

.trend-onboarding-cta {
  margin-top: 6px;
  padding: 11px 20px;
  border-radius: 10px;
  background: var(--trend-blue);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}

.trend-onboarding-cta:hover { background: #4a5cc9; }

.trend-section { padding: 30px 0; }
.trend-metric-section { padding-top: 12px; }
.trend-section + .trend-section { border-top: 1px solid #edf0f6; }
.trend-section-head { justify-content: space-between; gap: 24px; }

.trend-section-head h3,
.trend-next-goal h3 {
  margin: 5px 0 0;
  font-size: 20px;
  line-height: 1.42;
  letter-spacing: -.025em;
}

.trend-metric-section .trend-section-head h3 { font-size: 23px; }
.trend-metric-section .trend-section-head p { color: #9aa2b3; font-size: 12px; }

.trend-metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.trend-metric-card {
  min-width: 0;
  padding: 19px;
  border: 1px solid var(--trend-line);
  border-radius: 15px;
  background: #fff;
}

.trend-metric-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.trend-metric-card-head > span { color: var(--trend-muted); font-size: 12px; font-weight: 750; }
.trend-metric-card > strong { display: block; margin-top: 13px; font-size: 27px; line-height: 1; }
.trend-metric-card > strong small { margin-left: 4px; font-size: 12px; }

.trend-spark { display: flex; align-items: flex-end; gap: 4px; width: 24px; height: 24px; }
.trend-spark i { flex: 1; min-height: 5px; border-radius: 4px 4px 1px 1px; background: #aeb9f3; }

.metric-delta { display: block; margin-top: 11px; font-size: 10px; font-weight: 750; }
.metric-delta.is-positive { color: #16815a; }
.metric-delta.is-negative { color: #c45c4b; }
.is-disabled, .metric-delta.is-disabled { color: #a7adbb; }
.metric-delta.is-disabled { padding: 6px 8px; border: 1px dashed #d9dde6; border-radius: 7px; background: #f3f4f7; }

.trend-insight-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
.trend-insight-card { padding: 22px; border: 1px solid var(--trend-line); border-radius: 17px; }
.trend-insight-card.is-strength { border-color: #d8e2ff; background: #f7f9ff; }
.trend-insight-card.is-weakness { border-color: #f0dfd4; background: #fffaf6; }
.trend-insight-title { gap: 12px; }
.trend-insight-title > span { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: var(--trend-blue); color: #fff; font-weight: 900; }
.is-weakness .trend-insight-title > span { background: #d6855f; }
.trend-insight-title small { color: var(--trend-muted); font-size: 9px; font-weight: 850; letter-spacing: .1em; }
.trend-insight-title h4 { margin: 2px 0 0; font-size: 17px; }
.trend-insight-card ul { display: grid; margin: 17px 0 0; padding: 0; list-style: none; }
.trend-insight-card li { padding: 14px 0; border-top: 1px solid rgb(119 132 170 / 14%); }
.trend-insight-card li strong { font-size: 13px; }
.trend-insight-card li p, .trend-empty-copy { margin: 5px 0 0; color: var(--trend-muted); font-size: 11px; line-height: 1.55; }

.trend-reference-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 17px; }
.trend-reference-card { padding: 17px 18px; border: 1px solid var(--trend-line); border-radius: 13px; background: #fafbfe; }
.trend-reference-card span, .trend-reference-card small { display: block; color: var(--trend-muted); font-size: 10px; }
.trend-reference-card span { font-size: 11px; font-weight: 750; }
.trend-reference-card strong { display: block; margin: 8px 0 7px; font-size: 18px; }
.trend-reference-card em { color: #abb2c2; font-style: normal; }

.trend-metric-card.is-unavailable,
.trend-insight-card.is-unavailable,
.trend-reference-card.is-unavailable,
.trend-next-goal.is-unavailable {
  border: 1px dashed #d4d8e1;
  background: #f3f4f6;
  color: #969dac;
}

.trend-metric-card.is-unavailable .trend-metric-card-head > span,
.trend-reference-card.is-unavailable span,
.trend-reference-card.is-unavailable small,
.trend-insight-card.is-unavailable .trend-empty-copy,
.trend-next-goal.is-unavailable p {
  color: #9ca3b1;
}

.trend-insight-card.is-unavailable .trend-insight-title > span,
.trend-next-goal.is-unavailable .trend-goal-icon {
  background: #b7bdc9;
}

.trend-chart-head { align-items: flex-end; }
.trend-metric-selector { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 470px; }
.trend-metric-selector button { padding: 7px 13px; border: 1px solid #e1e5ef; border-radius: 999px; background: #fff; color: #7e889f; font-size: 11px; font-weight: 750; cursor: pointer; }
.trend-metric-selector button.active { border-color: var(--trend-blue); background: var(--trend-blue-soft); color: var(--trend-blue); }

.trend-history-chart { position: relative; margin-top: 18px; padding: 12px 20px 16px; border: 1px solid #edf0f6; border-radius: 15px; background: #fafbfe; overflow: hidden; }
.trend-history-chart svg { display: block; width: 100%; height: 215px; overflow: visible; }
.trend-chart-guide { stroke: #e8ebf3; stroke-width: 1; vector-effect: non-scaling-stroke; }
.trend-chart-axis-label { fill: #8b93a7; font-size: 9px; font-weight: 700; }
.trend-chart-divider { stroke: #d9deeb; stroke-width: 1; stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; }
.trend-chart-line { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.trend-chart-line.is-previous { stroke: #aeb5c7; }
.trend-chart-line.is-recent { stroke: var(--trend-blue); }
.trend-chart-connector { stroke: #c7ccda; stroke-width: 2; stroke-dasharray: 5 5; vector-effect: non-scaling-stroke; }
.trend-chart-dot { fill: #fff; stroke-width: 3; vector-effect: non-scaling-stroke; }
.trend-chart-dot.is-previous { stroke: #aeb5c7; }
.trend-chart-dot.is-recent { stroke: var(--trend-blue); }
.trend-chart-value { fill: #5f687c; font-size: 10px; font-weight: 800; }
.trend-chart-groups { display: grid; grid-template-columns: repeat(2, 1fr); color: #7f899f; font-size: 10px; font-weight: 800; text-align: center; }
.trend-history-missing { position: absolute; z-index: 1; inset: 28px 50% 37px 20px; display: grid; place-items: center; border: 1px dashed #d9dde6; border-radius: 10px; background: rgb(243 244 247 / 92%); font-size: 11px; font-weight: 750; }
.trend-history-missing.is-full { right: 20px; }

.trend-next-goal { align-items: flex-start; gap: 18px; margin-top: 4px; padding: 22px 24px; border-radius: 16px; background: #eef2ff; }
.trend-goal-icon { display: grid; flex: 0 0 38px; width: 38px; height: 38px; place-items: center; border-radius: 11px; background: var(--trend-blue); color: #fff; font-size: 20px; }

@media (max-width: 900px) {
  .trend-metric-grid, .trend-reference-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .trend-chart-head { align-items: flex-start; flex-direction: column; }
  .trend-metric-selector { justify-content: flex-start; max-width: none; }
}

@media (max-width: 780px) {
  :global(body.mypage-trend-page .mypage-layout) { grid-template-columns: minmax(0, 1fr) !important; gap: 20px !important; }
  :global(body.mypage-trend-page .mypage-nav) { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 0 0 12px !important; border-right: 0 !important; border-bottom: 1px solid var(--mypage-line); }
  :global(body.mypage-trend-page .mypage-nav a) { justify-content: center; padding: 0 8px; text-align: center; }
  .trend-dashboard-head, .trend-section-head { align-items: flex-start; flex-direction: column; }
  .trend-insight-grid { grid-template-columns: 1fr; }
}

@media (max-width: 520px) {
  .trend-dashboard-head h2 { font-size: 27px; }
  .trend-metric-grid, .trend-reference-grid { grid-template-columns: 1fr; }
  .trend-history-chart { padding-inline: 6px; }
  .trend-history-chart svg { height: 180px; }
  .trend-next-goal { padding: 19px; }
}
</style>
