import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { documentApi, readApiCollection, unwrapApiResponse } from '../api/index.js'
import {
  formatDocumentSize as formatSize,
  inferDocumentType as inferType,
  normalizeDocument,
} from '../api/normalizers/documents.js'
import { withMock } from '../api/withMock.js'
import { LOCAL_STORAGE_KEYS } from '../constants/storageKeys.js'
import { supportDocumentMocks } from '../mocks/supportDocuments.js'
import { createOpaqueLocalId } from '../utils/id.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'

const STORAGE_KEY = LOCAL_STORAGE_KEYS.supportDocuments

const responseItems = (response) => readApiCollection(response, ['items', 'documents', 'content'])
const readLocal = () => {
  const stored = readJsonStorage(localStorage, STORAGE_KEY)
  if (Array.isArray(stored)) return stored.map(normalizeDocument)
  const seed = supportDocumentMocks.map((item) => ({ ...item }))
  writeJsonStorage(localStorage, STORAGE_KEY, seed)
  return seed
}

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref(readLocal())
  const loading = ref(false)
  const error = ref('')

  const persist = () => {
    const serializable = documents.value.map((item) => ({
      ...item,
      previewUrl: item.previewUrl?.startsWith?.('blob:') ? null : item.previewUrl,
      downloadUrl: item.downloadUrl?.startsWith?.('blob:') ? null : item.downloadUrl,
    }))
    writeJsonStorage(localStorage, STORAGE_KEY, serializable)
  }

  const count = computed(() => documents.value.length)
  const find = (id) => documents.value.find((item) => String(item.id) === String(id)) ?? null

  const loadDocuments = async () => {
    loading.value = true
    error.value = ''
    try {
      const response = await withMock(
        () => documentApi.listDocuments(),
        () => ({ documents: readLocal() }),
      )
      documents.value = responseItems(response).map(normalizeDocument)
      persist()
      return documents.value
    } catch (requestError) {
      error.value = requestError?.message || '지원 자료를 불러오지 못했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  const loadDocument = async (id) => {
    const cached = find(id)
    const response = await withMock(
      () => documentApi.getDocument(id),
      () => cached,
    )
    return response ? normalizeDocument(unwrapApiResponse(response)) : null
  }

  const uploadDocument = async (file, type = inferType(file?.name)) => {
    loading.value = true
    error.value = ''
    const fallback = {
      id: createOpaqueLocalId('document'),
      name: file.name,
      type,
      size: formatSize(file.size),
      date: '방금 전',
      mimeType: file.type || 'application/octet-stream',
      previewUrl: globalThis.URL?.createObjectURL?.(file) ?? null,
    }
    try {
      const response = await withMock(
        () => documentApi.uploadDocument(file, type),
        () => fallback,
      )
      const created = normalizeDocument({ ...fallback, ...unwrapApiResponse(response) })
      documents.value = [created, ...documents.value.filter((item) => item.id !== created.id)]
      persist()
      return created
    } catch (requestError) {
      error.value = requestError?.message || '지원 자료 등록에 실패했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  const removeDocument = async (id) => {
    const target = find(id)
    if (!target) return false
    loading.value = true
    error.value = ''
    try {
      await withMock(() => documentApi.deleteDocument(id), () => ({ success: true }))
      documents.value = documents.value.filter((item) => item.id !== target.id)
      if (target.previewUrl?.startsWith?.('blob:')) globalThis.URL?.revokeObjectURL?.(target.previewUrl)
      persist()
      return true
    } catch (requestError) {
      error.value = requestError?.message || '지원 자료 삭제에 실패했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  return { documents, loading, error, count, find, loadDocuments, loadDocument, uploadDocument, removeDocument }
})
