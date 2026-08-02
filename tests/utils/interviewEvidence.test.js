import { describe, expect, it } from 'vitest'

import { buildInterviewEvidenceParts, normalizeInterviewEvidence } from '../../src/utils/interviewEvidence.js'

describe('interview evidence', () => {
  const answer = '저는 응답 시간을 30% 줄였습니다. 팀 협업도 개선했습니다.'

  it('keeps valid strength and weakness ranges without changing the answer', () => {
    const strengthText = '응답 시간을 30% 줄였습니다'
    const weaknessText = '팀 협업도 개선했습니다'
    const evidence = [
      {
        type: 'strength',
        text: strengthText,
        startIndex: answer.indexOf(strengthText),
        endIndex: answer.indexOf(strengthText) + strengthText.length,
        reason: '정량적 성과입니다.',
      },
      {
        type: 'weakness',
        text: weaknessText,
        startIndex: answer.indexOf(weaknessText),
        endIndex: answer.indexOf(weaknessText) + weaknessText.length,
        reason: '구체적인 협업 방법이 필요합니다.',
      },
    ]

    const parts = buildInterviewEvidenceParts(answer, evidence)

    expect(parts.map((part) => part.text).join('')).toBe(answer)
    expect(parts.filter((part) => part.evidence.length)).toHaveLength(2)
    expect(parts.flatMap((part) => part.evidence).map((item) => item.type)).toEqual(['strength', 'weakness'])
  })

  it('repairs a mismatched index by using the exact quoted text', () => {
    const normalized = normalizeInterviewEvidence(answer, [{
      type: 'strength',
      text: '응답 시간을 30% 줄였습니다',
      startIndex: 0,
      endIndex: 3,
      reason: '정량적 성과입니다.',
    }])

    expect(normalized[0]).toMatchObject({
      startIndex: answer.indexOf('응답 시간을 30% 줄였습니다'),
      text: '응답 시간을 30% 줄였습니다',
    })
  })

  it('drops unsupported types and invalid ranges', () => {
    expect(normalizeInterviewEvidence(answer, [
      { type: 'neutral', text: '저는', startIndex: 0, endIndex: 2 },
      { type: 'weakness', text: '', startIndex: 5, endIndex: 5 },
    ])).toEqual([])
  })
})
