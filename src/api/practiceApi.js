import { get, post, patch, del } from './client.js'
import { withQuery } from './query.js'

export const practiceApi = {
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
}
