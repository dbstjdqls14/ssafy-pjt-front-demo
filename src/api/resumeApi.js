import { del, get, post } from './client.js'
import { createFileFormData } from './formData.js'

// 면접 지원 자료 - 자기소개서. 백엔드 URL·필드명은 'resume'이지만 실제 데이터
// 모델(title+content 본문, 에러 메시지 "자기소개서 없음")은 자기소개서다.
// 이름은 URL 경로와 맞춰 resumeApi로 두되, 화면 라벨은 '자기소개서'를 쓴다.
export const resumeApi = {
  list() {
    return get('/resumes')
  },

  get(resumeId) {
    return get(`/resumes/${resumeId}`)
  },

  // multipart: title(필수) + file(필수) → { resumeId, resumePath, contentType }
  // 문서상 경로는 '/resumes/upload-url'이지만 실서버 확인 결과 그 경로는 POST를
  // 받지 않는다(OPTIONS Allow: GET,HEAD,DELETE,OPTIONS). 실제로 POST를 받는
  // 경로는 포트폴리오와 같은 패턴인 '/resumes/upload'(Allow에 POST 포함, 실측).
  upload({ title, file }) {
    return post('/resumes/upload', createFileFormData(file, { title }))
  },

  remove(resumeId) {
    return del(`/resumes/${resumeId}`)
  },
}
