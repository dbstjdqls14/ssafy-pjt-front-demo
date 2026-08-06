import { get, patch, post, put } from './client.js'
import { createFileFormData } from './formData.js'

const createPresentationFormData = ({ request, file }) => {
  const formData = new FormData()
  formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
  formData.append('file', file)
  return formData
}

const createCompleteFormData = (presentationId, { request, audio, video }) => {
  const formData = new FormData()
  formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
  formData.append('audio', audio, `presentation-${presentationId}.wav`)
  formData.append('video', video, `presentation-${presentationId}.webm`)
  return formData
}

export const presentationApi = {
  create({ request, file }) {
    return post('/presentations', createPresentationFormData({ request, file }))
  },

  // 같은 폴더의 이전 발표 자료(슬라이드)를 복사해 새 발표를 만든다. 파일 업로드와
  // 변환 과정이 없으므로 응답 시점에 이미 슬라이드가 준비된 상태로 온다.
  reuse(request) {
    return post('/presentations/reuse', request)
  },

  getStatus(presentationId) {
    return get(`/presentations/${presentationId}/status`)
  },

  getSlides(presentationId) {
    return get(`/presentations/${presentationId}/slides`)
  },

  getSlideImages(presentationId) {
    return get(`/presentations/${presentationId}/slides/image`)
  },

  getSlideImage(presentationId, slideNumber) {
    return get(`/presentations/${presentationId}/slides/${slideNumber}/image`)
  },

  reupload(presentationId, file) {
    return put(
      `/presentations/${presentationId}/presentation-document`,
      createFileFormData(file),
    )
  },

  updateDescriptions(presentationId, slides) {
    return patch(`/presentations/${presentationId}/slides/descriptions`, { slides })
  },

  start(presentationId) {
    return post(`/presentations/${presentationId}/start`)
  },

  createSlideEvent(presentationId, event) {
    return post(`/presentations/${presentationId}/slide-events`, event)
  },

  complete(presentationId, payload) {
    return post(
      `/presentations/${presentationId}/complete`,
      createCompleteFormData(presentationId, payload),
    )
  },

  generateQuestions(presentationId, slideVisits) {
    return post(
      `/presentations/${presentationId}/presentation-questions/generate`,
      slideVisits,
    )
  },

  getQuestions(presentationId) {
    return get(`/presentations/${presentationId}/presentation-questions`)
  },

  saveQuestionAnswer(questionId, answer) {
    return post(`/presentation-questions/${questionId}/answers`, { answer })
  },

  getReport(presentationId) {
    return get(`/presentations/${presentationId}/presentation-report`)
  },

  getReportJobStatus(presentationId) {
    return get(`/presentations/${presentationId}/report-job/status`)
  },
}
