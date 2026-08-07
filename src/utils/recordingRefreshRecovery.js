import { SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { readJsonStorage, writeJsonStorage } from './storage.js'

const ACTIVE_KEY = SESSION_STORAGE_KEYS.activeRecording
const ACTIVE_DOCUMENT_KEY = SESSION_STORAGE_KEYS.activeRecordingDocument
const NOTICE_KEY = SESSION_STORAGE_KEYS.recordingResetNotice
const RECORDING_KINDS = new Set(['presentation', 'interview'])
const DOCUMENT_INSTANCE_GLOBAL_KEY = '__aivoRecordingDocumentInstanceId__'

const isRecordingKind = (kind) => RECORDING_KINDS.has(kind)

const createDocumentInstanceId = () => (
  globalThis.crypto?.randomUUID?.()
  ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
)

const currentDocumentInstanceId = () => {
  // PerformanceNavigationTiming.type describes how the whole document was
  // opened and remains "reload" across later Vue Router navigation. Keep one
  // ID per live document so only a genuinely new document can reset recording.
  if (!globalThis[DOCUMENT_INSTANCE_GLOBAL_KEY]) {
    globalThis[DOCUMENT_INSTANCE_GLOBAL_KEY] = createDocumentInstanceId()
  }
  return globalThis[DOCUMENT_INSTANCE_GLOBAL_KEY]
}

export const markActiveRecording = (kind, documentInstanceId = currentDocumentInstanceId()) => {
  if (!isRecordingKind(kind)) return false
  sessionStorage.setItem(ACTIVE_KEY, kind)
  sessionStorage.setItem(ACTIVE_DOCUMENT_KEY, documentInstanceId)
  return true
}

export const clearActiveRecording = (kind = null) => {
  const activeKind = sessionStorage.getItem(ACTIVE_KEY)
  if (kind && activeKind !== kind) return false
  sessionStorage.removeItem(ACTIVE_KEY)
  sessionStorage.removeItem(ACTIVE_DOCUMENT_KEY)
  return activeKind != null
}

export const shouldResetRecordingAfterReload = (
  kind,
  performanceLike = globalThis.performance,
  documentInstanceId = currentDocumentInstanceId(),
) => {
  if (!isRecordingKind(kind)) return false
  const navigation = performanceLike?.getEntriesByType?.('navigation')?.[0]
  const activeKind = sessionStorage.getItem(ACTIVE_KEY)
  const recordingDocumentId = sessionStorage.getItem(ACTIVE_DOCUMENT_KEY)
  return navigation?.type === 'reload'
    && activeKind === kind
    && recordingDocumentId !== documentInstanceId
}

export const queueRecordingResetNotice = (kind, reason = null) => {
  if (!isRecordingKind(kind)) return false
  writeJsonStorage(sessionStorage, NOTICE_KEY, reason ? { kind, reason } : { kind })
  return true
}

export const consumeRecordingResetNotice = () => {
  const notice = readJsonStorage(sessionStorage, NOTICE_KEY, null)
  sessionStorage.removeItem(NOTICE_KEY)
  if (!isRecordingKind(notice?.kind)) return null
  return notice?.reason === 'completed-session'
    ? { kind: notice.kind, reason: 'completed-session' }
    : { kind: notice.kind }
}
