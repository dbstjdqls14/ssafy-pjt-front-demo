import { del, get, post } from './client.js'
import { createFileFormData } from './formData.js'

export const documentApi = {
  listDocuments() {
    return get('/users/me/documents')
  },

  getDocument(documentId) {
    return get(`/users/me/documents/${documentId}`)
  },

  uploadDocument(file, type) {
    return post('/users/me/documents', createFileFormData(file, { type }))
  },

  deleteDocument(documentId) {
    return del(`/users/me/documents/${documentId}`)
  },
}
