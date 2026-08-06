import { describe, expect, it } from 'vitest'

import { withQuery } from '../../src/api/query.js'

describe('withQuery', () => {
  it('appends encoded query parameters', () => {
    expect(withQuery('/reports', { type: 'presentation', keyword: '서비스 소개' }))
      .toBe('/reports?type=presentation&keyword=%EC%84%9C%EB%B9%84%EC%8A%A4+%EC%86%8C%EA%B0%9C')
  })

  it('omits empty optional values while preserving false and zero', () => {
    expect(withQuery('/items', { empty: '', missing: null, skip: undefined, enabled: false, page: 0 }))
      .toBe('/items?enabled=false&page=0')
  })

  it('returns the original path without parameters', () => {
    expect(withQuery('/items')).toBe('/items')
  })
})
