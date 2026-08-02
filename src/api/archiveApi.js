import { get } from './client.js'
import { withQuery } from './query.js'

export const archiveApi = {
  // 개별 연습 기록(리포트) 조회 — 폴더 단위 API와 별개로, 아직 백엔드에 전용
  // 엔드포인트가 없어 항상 withMock의 로컬 폴백으로 빠진다.
  listRecords(params = {}) {
    return get(withQuery('/reports', params))
  },

  getRecord(recordId) {
    return get(`/reports/${recordId}`)
  },

  // 내 기록: 연습 폴더 전체 조회. type: '' | 'presentation' | 'interview', keyword, page(0-base).
  listFolders(params = {}) {
    return get(withQuery('/practice-folders/archive', params))
  },

  // 내 기록: 연습 폴더 상세 조회 (name/description/attemptCount/maxScore/totalDuration).
  getFolderDetail(folderId) {
    return get(`/practice-folders/${folderId}/detail`)
  },

  // 연습 폴더 점수 추이 조회 (최근 7회 overall/voice/video/content 점수).
  getFolderScoreTrend(folderId) {
    return get(`/practice-folders/${folderId}/score-trend`)
  },

  // 연습 폴더 연습 기록 조회. sort: 'latest' | 'scoreAsc' | 'scoreDsc'.
  getFolderPractices(folderId, params = {}) {
    return get(withQuery(`/practice-folders/${folderId}/practices`, params))
  },

  getFolder(folderId) {
    return get(`/practice-folders/${folderId}`)
  },
}
