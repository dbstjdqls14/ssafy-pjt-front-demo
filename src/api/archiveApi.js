import { get } from './client.js'
import { withQuery } from './query.js'

export const archiveApi = {
  listFolders(params = {}) {
    return get(withQuery('/practice-folders/archive', params))
  },

  getFolder(folderId, params = {}) {
    return get(withQuery(`/practice-folders/${folderId}`, params))
  },

  listPractices(folderId, params = {}) {
    return get(withQuery(`/practice-folders/${folderId}/practices`, params))
  },
}
