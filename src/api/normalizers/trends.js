import { unwrapApiResponse } from '../response.js'
import { formatDecimal, formatPercent, formatScore, formatWpm } from '../../utils/displayFormatters.js'

const METRIC_DEFINITIONS = [
  { key: 'content', label: '\uC2AC\uB77C\uC774\uB4DC \uB0B4\uC6A9 \uC804\uB2EC', unit: '\uC810', deltaUnit: '\uC810', direction: 'higher', precision: 0 },
  { key: 'stability', label: '\uC790\uC138 \uC548\uC815\uB3C4', unit: '\uC810', deltaUnit: '\uC810', direction: 'higher', precision: 0 },
  { key: 'glance', label: '\uC2DC\uC120 \uC774\uD0C8 \uBC00\uB3C4', unit: '\uD68C/\uBD84', deltaUnit: '\uD68C/\uBD84', direction: 'lower', precision: 1 },
  { key: 'filler', label: '\uCD94\uC784\uC0C8 \uBC00\uB3C4', unit: '\uD68C/\uBD84', deltaUnit: '\uD68C/\uBD84', direction: 'lower', precision: 1 },
  { key: 'speed', label: '\uBC1C\uD654 \uC18D\uB3C4 \uBCC0\uB3D9\uB960', unit: '%', deltaUnit: '%p', direction: 'lower', precision: 1 },
  { key: 'totalTime', label: '\uBAA9\uD45C \uC2DC\uAC04 \uC624\uCC28', unit: '%', deltaUnit: '%p', direction: 'lower', precision: 1 },
]

const SCORE_DEFINITIONS = [
  { key: 'content', field: 'contentScore', label: '\uB0B4\uC6A9' },
  { key: 'video', field: 'videoScore', label: '\uBAB8\uC9D3' },
  { key: 'voice', field: 'voiceScore', label: '\uC74C\uC131' },
]

const toNumberOrNull = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const metricNumber = (definition, value) => {
  const number = toNumberOrNull(value)
  if (number == null) return null
  if (definition.unit === '\uC810' && (number < 0 || number > 100)) return null
  if (definition.direction === 'lower' && number < 0) return null
  return number
}

const scoreNumber = (value) => {
  const number = toNumberOrNull(value)
  return number != null && number >= 0 && number <= 100 ? number : null
}

const formatMetricValue = (definition, value) => definition.unit === '\uC810'
  ? formatScore(value)
  : formatDecimal(value, { maximumFractionDigits: definition.precision, minimum: 0 })

const makeMetric = (definition, earlyTrend, lateTrend, previousLabel = '\uC774\uC804 3\uD68C') => {
  const previousValue = metricNumber(definition, earlyTrend?.[definition.key])
  const value = metricNumber(definition, lateTrend?.[definition.key])

  if (previousValue == null || value == null) {
    return {
      ...definition,
      value,
      displayValue: formatMetricValue(definition, value),
      previousValue,
      delta: null,
      deltaLabel: null,
      tone: 'neutral',
    }
  }

  const delta = value - previousValue
  const magnitude = formatDecimal(Math.abs(delta), { maximumFractionDigits: definition.precision })
  const changeWord = delta > 0
    ? (definition.unit === '\uC810' ? '\uC0C1\uC2B9' : '\uC99D\uAC00')
    : (definition.unit === '\uC810' ? '\uD558\uB77D' : '\uAC10\uC18C')
  const improved = definition.direction === 'higher' ? delta > 0 : delta < 0

  return {
    ...definition,
    value,
    displayValue: formatMetricValue(definition, value),
    previousValue,
    delta,
    deltaLabel: delta === 0
      ? `${previousLabel}\uC640 \uB3D9\uC77C`
      : `${previousLabel}\uBCF4\uB2E4 ${magnitude}${definition.deltaUnit} ${changeWord}`,
    tone: delta === 0 ? 'neutral' : (improved ? 'positive' : 'negative'),
  }
}

const calculateLateChange = (early, late) => {
  const earlyNumber = toNumberOrNull(early)
  const lateNumber = toNumberOrNull(late)
  if (earlyNumber == null || lateNumber == null || earlyNumber === 0) return '-'

  const change = ((lateNumber - earlyNumber) / earlyNumber) * 100
  return `${change > 0 ? '+' : ''}${formatDecimal(change)}%`
}

export const normalizePracticeTrends = (response) => {
  const payload = unwrapApiResponse(response)
  const earlyTrend = payload?.earlyTrend ?? null
  const lateTrend = payload?.lateTrend ?? null
  const practices = Array.isArray(payload?.practices) ? payload.practices.slice(-6) : []
  const speech = payload?.speech ?? {}
  const previousCount = Math.floor(practices.length / 2)
  const recentCount = practices.length - previousCount
  const previousLabel = previousCount ? `\uC774\uC804 ${previousCount}\uD68C` : '\uC774\uC804 \uAE30\uB85D'
  const recentLabel = recentCount ? `\uCD5C\uADFC ${recentCount}\uD68C` : '\uCD5C\uADFC \uAE30\uB85D'
  const hasPreviousData = previousCount > 0 && recentCount > 0 && earlyTrend != null && lateTrend != null

  return {
    practices,
    hasPreviousData,
    previousCount,
    recentCount,
    previousLabel,
    recentLabel,
    metrics: METRIC_DEFINITIONS.map((definition) => makeMetric(definition, earlyTrend, lateTrend, previousLabel)),
    scoreSeries: SCORE_DEFINITIONS.map((definition) => ({
      key: definition.key,
      label: definition.label,
      values: practices.map((practice) => scoreNumber(practice?.[definition.field])),
    })),
    speechReference: {
      averageWpm: formatWpm(speech.averageSpeechSpeed),
      earlyWpm: formatWpm(speech.earlySpeechSpeed),
      lateWpm: formatWpm(speech.lateSpeechSpeed),
      lateChange: calculateLateChange(speech.earlySpeechSpeed, speech.lateSpeechSpeed),
      silenceRatio: formatPercent(speech.silenceLate),
    },
  }
}
