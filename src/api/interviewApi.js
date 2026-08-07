import { get, post, patch } from './client.js'
import { createFileFormData, createRecordingFormData } from './formData.js'

export const interviewApi = {
  createSession(payload) {
    return post('/interview-sessions', payload)
  },

  getSession(sessionId) {
    return get(`/interview-sessions/${sessionId}`)
  },

  updateSession(sessionId, payload) {
    return patch(`/interview-sessions/${sessionId}`, payload)
  },

  uploadResume(sessionId, file) {
    return post(`/interview-sessions/${sessionId}/resume`, createFileFormData(file))
  },

  listQuestions(sessionId) {
    return get(`/interview-sessions/${sessionId}/questions`)
  },

  submitRecording(sessionId, { blob, metadata }) {
    const formData = createRecordingFormData({
      blob,
      metadata,
      fileName: `interview-${sessionId}.webm`,
    })
    return post(`/interview-sessions/${sessionId}/recordings`, formData)
  },

  completeSession(sessionId, payload = {}) {
    return post(`/interview-sessions/${sessionId}/complete`, payload)
  },

  getAnalysis(sessionId) {
    return get(`/interview-sessions/${sessionId}/analysis`)
  },

  getReport(sessionId) {
    return get(`/interview-sessions/${sessionId}/report`)
  },
}
