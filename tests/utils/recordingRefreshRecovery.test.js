import { beforeEach, describe, expect, test } from 'vitest'

import {
  clearActiveRecording,
  consumeRecordingResetNotice,
  markActiveRecording,
  queueRecordingResetNotice,
  shouldResetRecordingAfterReload,
} from '../../src/utils/recordingRefreshRecovery.js'

const navigationPerformance = (type) => ({
  getEntriesByType: (entryType) => (
    entryType === 'navigation' ? [{ type }] : []
  ),
})

describe('recording refresh recovery', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  test('requests a reset only for a reload with the matching active recording kind', () => {
    markActiveRecording('presentation')

    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('reload'),
    )).toBe(true)
    expect(shouldResetRecordingAfterReload(
      'interview',
      navigationPerformance('reload'),
    )).toBe(false)
    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('navigate'),
    )).toBe(false)
  })

  test('clears only the matching active recording kind', () => {
    markActiveRecording('presentation')

    clearActiveRecording('interview')
    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('reload'),
    )).toBe(true)

    clearActiveRecording('presentation')
    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('reload'),
    )).toBe(false)
  })

  test('consumes a queued reset notice exactly once', () => {
    queueRecordingResetNotice('interview')

    expect(consumeRecordingResetNotice()).toEqual({ kind: 'interview' })
    expect(consumeRecordingResetNotice()).toBeNull()
  })
})
