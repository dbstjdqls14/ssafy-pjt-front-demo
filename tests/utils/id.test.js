import { describe, expect, it } from 'vitest'

import { createLocalId, createOpaqueLocalId } from '../../src/utils/id.js'

describe('local id helpers', () => {
  it('keeps a domain prefix for transient local entities', () => {
    expect(createLocalId('transcript')).toMatch(/^transcript-.+/)
    expect(createLocalId('local-recording')).toMatch(/^local-recording-.+/)
  })

  it('creates a non-empty opaque id for Store fallback entities', () => {
    expect(createOpaqueLocalId('folder')).toEqual(expect.any(String))
    expect(createOpaqueLocalId('folder').length).toBeGreaterThan(0)
  })
})
