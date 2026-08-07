import { get, post, patch } from './client.js'
import { createFileFormData, createRecordingFormData } from './formData.js'

export const presentationApi = {
  createSession(payload) {
    return post('/presentation-sessions', payload)
  },

  getSession(sessionId) {
    return get(`/presentation-sessions/${sessionId}`)
  },

  updateSession(sessionId, payload) {
    return patch(`/presentation-sessions/${sessionId}`, payload)
  },

  uploadSlides(sessionId, file) {
    return post(`/presentation-sessions/${sessionId}/slides`, createFileFormData(file))
  },

  updateSlideNotes(sessionId, slideId, payload) {
    return patch(`/presentation-sessions/${sessionId}/slides/${slideId}`, payload)
  },

  recordSlideProgress(sessionId, payload) {
    return post(`/presentation-sessions/${sessionId}/slide-events`, payload)
  },

  submitRecording(sessionId, { blob, metadata }) {
    const formData = createRecordingFormData({
      blob,
      metadata,
      fileName: `presentation-${sessionId}.webm`,
    })
    return post(`/presentation-sessions/${sessionId}/recordings`, formData)
  },

  completeSession(sessionId, payload) {
    return post(`/presentation-sessions/${sessionId}/complete`, payload)
  },

  getReport(sessionId) {
    return get(`/presentation-sessions/${sessionId}/report`)
  },
}
