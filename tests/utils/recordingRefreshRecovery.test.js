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

  test('does not reset a recording during SPA navigation in the same document', () => {
    markActiveRecording('presentation', 'document-a')

    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('reload'),
      'document-a',
    )).toBe(false)
  })

  test('requests a reset only when a reload creates a new document for the active recording', () => {
    markActiveRecording('presentation', 'document-a')

    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('reload'),
      'document-b',
    )).toBe(true)
    expect(shouldResetRecordingAfterReload(
      'interview',
      navigationPerformance('reload'),
      'document-b',
    )).toBe(false)
    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('navigate'),
      'document-b',
    )).toBe(false)
  })

  test('clears only the matching active recording kind', () => {
    markActiveRecording('presentation', 'document-a')

    clearActiveRecording('interview')
    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('reload'),
      'document-b',
    )).toBe(true)

    clearActiveRecording('presentation')
    expect(shouldResetRecordingAfterReload(
      'presentation',
      navigationPerformance('reload'),
      'document-b',
    )).toBe(false)
  })

  test('consumes a queued reset notice exactly once', () => {
    queueRecordingResetNotice('interview')

    expect(consumeRecordingResetNotice()).toEqual({ kind: 'interview' })
    expect(consumeRecordingResetNotice()).toBeNull()
  })
})
