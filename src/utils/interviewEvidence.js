const EVIDENCE_TYPES = new Set(['strength', 'weakness'])

const clampIndex = (value, length) => Math.min(length, Math.max(0, Number(value) || 0))

export const normalizeInterviewEvidence = (answer = '', evidence = []) => {
  const text = String(answer ?? '')
  if (!text || !Array.isArray(evidence)) return []

  return evidence.flatMap((item, index) => {
    if (!item || !EVIDENCE_TYPES.has(item.type)) return []

    const quotedText = String(item.text ?? '')
    let startIndex = clampIndex(item.startIndex, text.length)
    let endIndex = clampIndex(item.endIndex, text.length)

    // LLM/서버의 인덱스가 한두 글자 어긋나도 원문 인용이 정확하면 그 위치를
    // 우선한다. 같은 문장이 여러 번 나오면 전달받은 startIndex와 가장 가까운
    // 항목을 고른다.
    if (quotedText && text.slice(startIndex, endIndex) !== quotedText) {
      const matches = []
      let cursor = text.indexOf(quotedText)
      while (cursor !== -1) {
        matches.push(cursor)
        cursor = text.indexOf(quotedText, cursor + 1)
      }
      if (matches.length) {
        startIndex = matches.reduce((best, candidate) => (
          Math.abs(candidate - startIndex) < Math.abs(best - startIndex) ? candidate : best
        ), matches[0])
        endIndex = startIndex + quotedText.length
      }
    }

    if (endIndex <= startIndex) return []

    return [{
      id: `${item.type}-${startIndex}-${endIndex}-${index}`,
      type: item.type,
      text: text.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      reason: String(item.reason ?? '').trim(),
    }]
  }).sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex)
}

export const buildInterviewEvidenceParts = (answer = '', evidence = []) => {
  const text = String(answer ?? '')
  const normalized = normalizeInterviewEvidence(text, evidence)
  if (!text) return []
  if (!normalized.length) return [{ text, evidence: [] }]

  const boundaries = [...new Set([
    0,
    text.length,
    ...normalized.flatMap((item) => [item.startIndex, item.endIndex]),
  ])].sort((a, b) => a - b)

  return boundaries.slice(0, -1).flatMap((startIndex, index) => {
    const endIndex = boundaries[index + 1]
    if (endIndex <= startIndex) return []
    return [{
      text: text.slice(startIndex, endIndex),
      evidence: normalized.filter((item) => item.startIndex < endIndex && item.endIndex > startIndex),
    }]
  })
}
