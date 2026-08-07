import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { practiceApi, readApiCollection, unwrapApiResponse } from '../api/index.js'
import { normalizePracticeFolder as normalizeFolder } from '../api/normalizers/practice.js'
import { withMock } from '../api/withMock.js'
import { SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { practiceFolderMocks } from '../mocks/practiceFolders.js'
import { createOpaqueLocalId } from '../utils/id.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'

const FLOW_KEY = SESSION_STORAGE_KEYS.practiceFlow

const loadDraft = () => readJsonStorage(sessionStorage, FLOW_KEY, {}) || {}
const responseItems = (response) => readApiCollection(response, ['folders', 'items', 'content'])
const matches = (folder, { type, keyword } = {}) => {
  const normalizedKeyword = String(keyword ?? '').trim().toLocaleLowerCase('ko-KR')
  return (!type || folder.type === type)
    && (!normalizedKeyword || folder.name.toLocaleLowerCase('ko-KR').includes(normalizedKeyword))
}

export const usePracticeStore = defineStore('practice', () => {
  const draft = loadDraft()
  const mode = ref(draft.mode ?? null)
  const folderId = ref(draft.folderId ?? null)
  const folderName = ref(draft.folderName ?? '')
  const folders = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  let requestSequence = 0

  watch([mode, folderId, folderName], () => {
    writeJsonStorage(sessionStorage, FLOW_KEY, { mode: mode.value, folderId: folderId.value, folderName: folderName.value })
  })

  const setMode = (nextMode) => { mode.value = nextMode }
  const setFolder = ({ id, name } = {}) => {
    if (id !== undefined) folderId.value = id
    if (name !== undefined) folderName.value = name
  }

  const loadFolders = async (params = {}) => {
    const sequence = ++requestSequence
    loading.value = true
    error.value = ''
    try {
      const response = await withMock(
        () => practiceApi.listFolders(params),
        () => ({ folders: practiceFolderMocks.filter((folder) => matches(folder, params)) }),
      )
      const loaded = responseItems(response).map(normalizeFolder)
      if (sequence === requestSequence) folders.value = loaded
      return loaded
    } catch (requestError) {
      if (sequence === requestSequence) error.value = requestError?.message || '연습 폴더를 불러오지 못했습니다.'
      throw requestError
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  const createFolder = async ({ name, type, description = '' }) => {
    saving.value = true
    error.value = ''
    const fallback = { folderId: createOpaqueLocalId('folder'), name, type, description, attempts: [] }
    try {
      const response = await withMock(() => practiceApi.createFolder({ name, type, description }), () => fallback)
      const created = normalizeFolder({ ...fallback, ...unwrapApiResponse(response) })
      folders.value = [created, ...folders.value.filter((folder) => folder.id !== created.id)]
      setMode(type)
      setFolder({ id: created.id, name: created.name })
      return created
    } catch (requestError) {
      error.value = requestError?.message || '연습 폴더를 만들지 못했습니다.'
      throw requestError
    } finally {
      saving.value = false
    }
  }

  const renameFolder = async (id, name) => {
    const response = await withMock(() => practiceApi.updateFolder(id, { name }), () => ({ folderId: id, name }))
    const target = folders.value.find((folder) => folder.id === String(id))
    if (target) target.name = unwrapApiResponse(response).name ?? name
    if (String(folderId.value) === String(id)) folderName.value = target?.name ?? name
    return target
  }

  const removeFolder = async (id) => {
    await withMock(() => practiceApi.deleteFolder(id), () => ({ success: true }))
    folders.value = folders.value.filter((folder) => folder.id !== String(id))
    if (String(folderId.value) === String(id)) setFolder({ id: null, name: '' })
  }

  const reset = () => {
    mode.value = null
    folderId.value = null
    folderName.value = ''
    folders.value = []
    error.value = ''
    sessionStorage.removeItem(FLOW_KEY)
  }

  return {
    mode, folderId, folderName, folders, loading, saving, error,
    setMode, setFolder, loadFolders, createFolder, renameFolder, removeFolder, reset,
  }
})
