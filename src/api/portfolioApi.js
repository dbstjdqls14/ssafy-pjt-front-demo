import { del, get, post } from './client.js'
import { createFileFormData } from './formData.js'

// 면접 지원 자료 - 포트폴리오. 무인증 아님(Bearer 필수), 로그인한 사용자 소유 목록만.
export const portfolioApi = {
  list() {
    return get('/portfolios')
  },

  get(portfolioId) {
    return get(`/portfolios/${portfolioId}`)
  },

  // multipart: title(필수) + file(필수) → { portfolioId, portfolioPath, contentType }
  upload({ title, file }) {
    return post('/portfolios/upload', createFileFormData(file, { title }))
  },

  remove(portfolioId) {
    return del(`/portfolios/${portfolioId}`)
  },
}
