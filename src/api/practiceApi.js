import { get, post, patch, del } from './client.js'
import { withQuery } from './query.js'

export const practiceApi = {
  analyzeAudio(practiceId, { blob, sequence, fileName = `chunk-${sequence}.wav` }) {
    const formData = new FormData()
    formData.append('audio', blob, fileName)
    return post(withQuery(`/practices/${practiceId}/audio-analysis`, { sequence }), formData)
  },

  listFolders(params = {}) {
    return get(withQuery('/practice-folders', params))
  },

  // 폴더의 과거 발표 연습 목록 = 재사용 가능한 자료 목록. 전용 /materials API가
  // 없어 기존 /presentation-practices 응답을 자료 선택 UI가 쓰는 모양으로
  // 맞춰준다. 응답: { materials: [{ id(=presentationId), name(=title), type, uploadedAt } ]}
  // type은 서버가 원본 파일 종류를 안 내려줘서 항상 null — UI가 배지를 숨긴다.
  listFolderMaterials(folderId) {
    return get(`/practice-folders/${folderId}/presentation-practices`).then((response) => {
      const practices = response?.practices ?? (Array.isArray(response) ? response : [])
      return {
        materials: practices.map((item) => ({
          id: item.presentationId,
          name: item.title,
          type: null,
          uploadedAt: item.createdAt,
        })),
      }
    })
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
}
