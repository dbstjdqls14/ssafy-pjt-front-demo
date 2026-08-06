const toFiniteNumber = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const numberFormatters = new Map()

const getNumberFormatter = (maximumFractionDigits) => {
  if (!numberFormatters.has(maximumFractionDigits)) {
    numberFormatters.set(maximumFractionDigits, new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
      useGrouping: true,
    }))
  }
  return numberFormatters.get(maximumFractionDigits)
}

export const formatDecimal = (value, {
  maximumFractionDigits = 1,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
  fallback = '-',
} = {}) => {
  const number = toFiniteNumber(value)
  if (number == null || number < minimum || number > maximum) return fallback
  return getNumberFormatter(maximumFractionDigits).format(number)
}

export const formatScore = (value, fallback = '-') => formatDecimal(value, {
  maximumFractionDigits: 0,
  minimum: 0,
  maximum: 100,
  fallback,
})

export const formatCount = (value, fallback = '-') => formatDecimal(value, {
  maximumFractionDigits: 0,
  minimum: 0,
  fallback,
})

export const formatWpm = (value, fallback = '-') => {
  const formatted = formatDecimal(value, { minimum: 0, fallback })
  return formatted === fallback ? fallback : `${formatted} WPM`
}

export const formatWordsPerSecond = (value, fallback = '-') => {
  const wpm = toFiniteNumber(value)
  if (wpm == null || wpm < 0) return fallback
  return `초당 ${(wpm / 60).toFixed(2)}어절`
}

export const formatPercent = (value, fallback = '-') => {
  const formatted = formatDecimal(value, { minimum: 0, fallback })
  return formatted === fallback ? fallback : `${formatted}%`
}
