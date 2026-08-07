import { get } from './client.js'
import { withQuery } from './query.js'

export const archiveApi = {
  listRecords(params = {}) {
    return get(withQuery('/reports', params))
  },

  getRecord(recordId) {
    return get(`/reports/${recordId}`)
  },

  getFolder(folderId) {
    return get(`/practice-folders/${folderId}`)
  },
}
