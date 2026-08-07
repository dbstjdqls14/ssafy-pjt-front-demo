import { get, post, patch, del } from './client.js'
import { withQuery } from './query.js'

export const practiceApi = {
  analyzeAudio(practiceId, { blob, sequence, fileName = `chunk-${sequence}.wav` }) {
    const formData = new FormData()
    formData.append('audio', blob, fileName)
    formData.append('sequence', String(sequence))
    return post(`/practices/${practiceId}/audio-analysis`, formData)
  },

  listFolders(params = {}) {
    return get(withQuery('/practice-folders', params))
  },

  createFolder(payload) {
    return post('/practice-folders', payload)
  },

  updateFolder(folderId, payload) {
    return patch(`/practice-folders/${folderId}`, payload)
  },

  deleteFolder(folderId) {
    return del(`/practice-folders/${folderId}`)
  },

  // 폴더에 쌓인 발표 연습 목록. 같은 폴더에서 새 연습을 시작할 때 이전에 올린
  // 발표 자료를 다시 쓰기 위한 후보 목록으로 쓴다.
  listPresentationPractices(folderId) {
    return get(`/practice-folders/${folderId}/presentation-practices`)
  },
}
