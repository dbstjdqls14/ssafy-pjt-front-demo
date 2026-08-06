import { SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { readJsonStorage, writeJsonStorage } from './storage.js'

const ACTIVE_KEY = SESSION_STORAGE_KEYS.activeRecording
const NOTICE_KEY = SESSION_STORAGE_KEYS.recordingResetNotice
const RECORDING_KINDS = new Set(['presentation', 'interview'])

const isRecordingKind = (kind) => RECORDING_KINDS.has(kind)

export const markActiveRecording = (kind) => {
  if (!isRecordingKind(kind)) return false
  sessionStorage.setItem(ACTIVE_KEY, kind)
  return true
}

export const clearActiveRecording = (kind = null) => {
  const activeKind = sessionStorage.getItem(ACTIVE_KEY)
  if (kind && activeKind !== kind) return false
  sessionStorage.removeItem(ACTIVE_KEY)
  return activeKind != null
}

export const shouldResetRecordingAfterReload = (
  kind,
  performanceLike = globalThis.performance,
) => {
  if (!isRecordingKind(kind)) return false
  const navigation = performanceLike?.getEntriesByType?.('navigation')?.[0]
  return navigation?.type === 'reload' && sessionStorage.getItem(ACTIVE_KEY) === kind
}

export const queueRecordingResetNotice = (kind) => {
  if (!isRecordingKind(kind)) return false
  writeJsonStorage(sessionStorage, NOTICE_KEY, { kind })
  return true
}

export const consumeRecordingResetNotice = () => {
  const notice = readJsonStorage(sessionStorage, NOTICE_KEY, null)
  sessionStorage.removeItem(NOTICE_KEY)
  return isRecordingKind(notice?.kind) ? notice : null
}
