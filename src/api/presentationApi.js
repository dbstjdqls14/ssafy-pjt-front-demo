import { get, patch, post, put } from './client.js'
import { createFileFormData } from './formData.js'

const createPresentationFormData = ({ request, file }) => {
  const formData = new FormData()
  formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
  formData.append('file', file)
  return formData
}

export const presentationApi = {
  create({ request, file }) {
    return post('/presentations', createPresentationFormData({ request, file }))
  },

  // 폴더 내 완료된 과거 발표(sourcePresentationId)의 슬라이드를 그대로 복사해
  // 새 발표를 만든다. 파일 업로드 없이 생성되고 서버에서 즉시 COMPLETED 처리됨.
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

  complete(presentationId, durationMs) {
    return post(`/presentations/${presentationId}/complete`, { durationMs })
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
}
