import { describe, expect, it, vi } from 'vitest'

import {
  readBooleanStorage,
  readJsonStorage,
  writeBooleanStorage,
  writeJsonStorage,
} from '../../src/utils/storage.js'

const createStorage = (rawValue) => ({
  getItem: vi.fn(() => rawValue),
  setItem: vi.fn(),
})

describe('JSON storage helpers', () => {
  it('reads stored JSON values', () => {
    const storage = createStorage('{"mode":"presentation"}')
    expect(readJsonStorage(storage, 'flow', {})).toEqual({ mode: 'presentation' })
    expect(storage.getItem).toHaveBeenCalledWith('flow')
  })

  it('uses the fallback for missing, empty, malformed, or unavailable storage', () => {
    expect(readJsonStorage(createStorage(null), 'key', {})).toEqual({})
    expect(readJsonStorage(createStorage(''), 'key', [])).toEqual([])
    expect(readJsonStorage(createStorage('{bad-json'), 'key', null)).toBeNull()

    const unavailable = createStorage(null)
    unavailable.getItem.mockImplementation(() => { throw new Error('blocked') })
    expect(readJsonStorage(unavailable, 'key', 'fallback')).toBe('fallback')
  })

  it('serializes values through the Storage contract', () => {
    const storage = createStorage(null)
    writeJsonStorage(storage, 'flow', { step: 2 })
    expect(storage.setItem).toHaveBeenCalledWith('flow', '{"step":2}')
  })

  it('reads and writes boolean flags used by first-visit tutorials', () => {
    expect(readBooleanStorage(createStorage('true'), 'tutorial')).toBe(true)
    expect(readBooleanStorage(createStorage('false'), 'tutorial')).toBe(false)
    expect(readBooleanStorage(createStorage(null), 'tutorial')).toBe(false)

    const storage = createStorage(null)
    expect(writeBooleanStorage(storage, 'tutorial')).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith('tutorial', 'true')
  })

  it('keeps tutorial state non-blocking when storage writes are unavailable', () => {
    const unavailable = createStorage(null)
    unavailable.setItem.mockImplementation(() => { throw new Error('blocked') })
    expect(writeBooleanStorage(unavailable, 'tutorial')).toBe(false)
  })
})
