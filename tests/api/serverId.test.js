import { describe, expect, test } from 'vitest'

import { parseOptionalServerId, parseServerId, parseServerIdList } from '../../src/api/serverId.js'

describe('server id contract', () => {
  test('normalizes numeric ids before sending them to Spring Long fields', () => {
    expect(parseServerId('190')).toBe(190)
    expect(parseOptionalServerId(2, '면접관')).toBe(2)
    expect(parseServerIdList(['2', 3], '자기소개서')).toEqual([2, 3])
  })

  test('rejects former mock ids before an API request is sent', () => {
    expect(parseServerId('interview-backend')).toBeNull()
    expect(() => parseOptionalServerId('local-interviewer-1', '면접관')).toThrow('면접관 정보가 실제 서버 데이터가 아니에요')
  })
})
