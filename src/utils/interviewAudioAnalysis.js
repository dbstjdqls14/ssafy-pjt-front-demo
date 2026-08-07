const toNonNegativeInteger = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0
}

const toSequenceKey = (value) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : String(value ?? '')
}

export const adaptiveVoiceThreshold = (
  noiseFloorRms,
  { minimum = 0.018, multiplier = 2.5 } = {},
) => Math.max(minimum, Math.max(0, Number(noiseFloorRms) || 0) * multiplier)

// audio-analysis 응답은 청크별 fillerCount를 기본 계약으로 사용한다. 서버가
// 누적값을 명시적으로 반환하는 경우에는 total 계열 필드를 우선하며, 같은
// sequence가 다시 도착해도 두 번 더하지 않는다.
export const createFillerAccumulator = () => {
  const processedSequences = new Set()
  let total = 0

  const reset = () => {
    processedSequences.clear()
    total = 0
  }

  const apply = (analysis = {}, fallbackSequence = '') => {
    const sequence = toSequenceKey(analysis.sequence ?? fallbackSequence)
    if (processedSequences.has(sequence)) return total
    processedSequences.add(sequence)

    const explicitTotal = analysis.totalFillerCount ?? analysis.cumulativeFillerCount
    if (explicitTotal != null) {
      total = Math.max(total, toNonNegativeInteger(explicitTotal))
      return total
    }

    const fillerCount = toNonNegativeInteger(analysis.fillerCount)
    const countScope = String(analysis.fillerCountScope ?? analysis.countScope ?? '').toLowerCase()
    if (countScope === 'cumulative' || countScope === 'session' || countScope === 'total') {
      total = Math.max(total, fillerCount)
      return total
    }

    total += fillerCount
    return total
  }

  return { apply, reset, value: () => total }
}
