export const toReportScore = (value, fallback = 0) => {
  if (value == null || value === '') return fallback
  const score = Number(value)
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : fallback
}

const normalizeMetricLabel = (label) => {
  const value = label ?? ''
  return ['\uD544\uB7EC', '\uD544\uB7EC\uC6CC\uB4DC', '\uD544\uB7EC\uC5B4'].includes(value)
    ? '추임새'
    : value
}

export const normalizeReportScoreCards = (scoreCards, fallbackCards = []) => {
  if (!Array.isArray(scoreCards) || scoreCards.length === 0) return fallbackCards

  return scoreCards.map((card, index) => {
    const label = card?.label ?? `항목 ${index + 1}`
    const metrics = Array.isArray(card?.metrics) ? card.metrics : []

    return {
      label,
      value: toReportScore(card?.score, null),
      title: label,
      rows: metrics.map((metric) => [normalizeMetricLabel(metric?.label), metric?.value ?? '']),
    }
  })
}
