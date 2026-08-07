import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { archiveApi, practiceApi, readApiCollection, unwrapApiResponse } from '../api/index.js'
import {
  normalizeArchivePractice,
  normalizePracticeFolder as normalizeFolder,
} from '../api/normalizers/practice.js'
import { parseServerId } from '../api/serverId.js'
import { LOCAL_STORAGE_KEYS, SESSION_STORAGE_KEYS } from '../constants/storageKeys.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'

const FLOW_KEY = SESSION_STORAGE_KEYS.practiceFlow
const FOLDER_TYPES_KEY = LOCAL_STORAGE_KEYS.practiceFolderTypes

const loadDraft = () => readJsonStorage(sessionStorage, FLOW_KEY, {}) || {}
const loadFolderTypes = () => readJsonStorage(localStorage, FOLDER_TYPES_KEY, {}) || {}
const responseItems = (response) => readApiCollection(response, ['folders', 'items', 'content'])
const recentPracticeItems = (response) => readApiCollection(response, ['practices', 'items', 'content'])

const loadCompletedReportStats = async (params = {}) => {
  const stats = new Map()
  let page = 0
  let totalPage = 1

  do {
    const response = await archiveApi.listFolders({ ...params, page })
    const payload = unwrapApiResponse(response)
    responseItems(response).forEach((folder) => {
      const id = parseServerId(folder.folderId ?? folder.id)
      if (id === null) return
      const normalized = normalizeFolder(folder)
      const count = Number(folder.attemptCount ?? folder.practiceCount ?? 0)
      stats.set(String(id), {
        reportCount: Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0,
        best: normalized.best,
        latestScore: normalized.latestScore,
        recentPracticeDate: folder.recentPracticeDate ?? null,
      })
    })
    totalPage = Math.max(1, Number(payload.totalPage ?? payload.totalPages ?? 1) || 1)
    page += 1
  } while (page < totalPage && page < 100)

  return stats
}

export const usePracticeStore = defineStore('practice', () => {
  const draft = loadDraft()
  const restoredFolderId = parseServerId(draft.folderId) === null ? null : draft.folderId
  const mode = ref(draft.mode ?? null)
  const folderId = ref(restoredFolderId)
  const folderName = ref(restoredFolderId === null ? '' : (draft.folderName ?? ''))
  const folders = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const recentPractices = ref([])
  const recentPracticeCount = ref(0)
  const recentPracticesLoading = ref(false)
  const recentPracticesError = ref('')
  const folderTypes = ref(loadFolderTypes())
  let requestSequence = 0
  let recentPracticeRequestSequence = 0

  watch([mode, folderId, folderName], () => {
    writeJsonStorage(sessionStorage, FLOW_KEY, { mode: mode.value, folderId: folderId.value, folderName: folderName.value })
  })

  const setMode = (nextMode) => { mode.value = nextMode }
  const setFolder = ({ id, name } = {}) => {
    if (id !== undefined) folderId.value = id
    if (name !== undefined) folderName.value = name
  }

  const rememberFolderType = (id, type) => {
    const parsedId = parseServerId(id)
    if (parsedId === null || !['presentation', 'interview'].includes(type)) return
    folderTypes.value = { ...folderTypes.value, [String(parsedId)]: type }
    writeJsonStorage(localStorage, FOLDER_TYPES_KEY, folderTypes.value)
  }

  const loadFolders = async (params = {}) => {
    const sequence = ++requestSequence
    loading.value = true
    error.value = ''
    try {
      const response = await practiceApi.listFolders(params)
      let completedReportStats = null
      try {
        completedReportStats = await loadCompletedReportStats(params)
      } catch {
        // Keep folder selection available when archive lookup fails, but never
        // fall back to the general attemptCount because it includes abandoned
        // practices and would display an incorrect completed-practice count.
      }
      const requestedType = params.type === 'interview' ? 'interview' : params.type === 'presentation' ? 'presentation' : null
      const loaded = responseItems(response)
        .map(normalizeFolder)
        .map((folder) => {
          const archiveStats = completedReportStats?.get(String(folder.id))
          return {
            ...folder,
            type: folderTypes.value[folder.id] ?? folder.type,
            reportCount: archiveStats?.reportCount ?? (completedReportStats ? 0 : null),
            best: archiveStats?.best ?? null,
            latestScore: archiveStats?.latestScore ?? null,
            recentPracticeDate: archiveStats?.recentPracticeDate ?? null,
          }
        })
        .filter((folder) => !requestedType || folder.type === requestedType)
      if (sequence === requestSequence) folders.value = loaded
      return loaded
    } catch (requestError) {
      if (sequence === requestSequence) {
        error.value = requestError?.status === 405
          ? '기존 폴더 조회 API가 아직 연결되지 않았어요.'
          : requestError?.message || '연습 폴더를 불러오지 못했습니다.'
      }
      throw requestError
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  const clearRecentPractices = () => {
    recentPracticeRequestSequence += 1
    recentPractices.value = []
    recentPracticeCount.value = 0
    recentPracticesLoading.value = false
    recentPracticesError.value = ''
  }

  const loadRecentPractices = async (selectedFolderId) => {
    const parsedFolderId = parseServerId(selectedFolderId)
    if (parsedFolderId === null) {
      clearRecentPractices()
      return []
    }

    const sequence = ++recentPracticeRequestSequence
    recentPractices.value = []
    recentPracticeCount.value = 0
    recentPracticesLoading.value = true
    recentPracticesError.value = ''

    try {
      const response = await archiveApi.listPractices(parsedFolderId, { page: 0, sort: 'latest' })
      const payload = unwrapApiResponse(response)
      const items = recentPracticeItems(response).map(normalizeArchivePractice).slice(0, 3)
      const count = Number(payload.attemptCount)

      if (sequence === recentPracticeRequestSequence) {
        recentPractices.value = items
        recentPracticeCount.value = Number.isFinite(count)
          ? Math.max(0, Math.trunc(count))
          : items.length
      }
      return items
    } catch (requestError) {
      if (sequence === recentPracticeRequestSequence) {
        recentPracticesError.value = requestError?.message || '최근 연습 기록을 불러오지 못했습니다.'
      }
      throw requestError
    } finally {
      if (sequence === recentPracticeRequestSequence) recentPracticesLoading.value = false
    }
  }

  const createFolder = async ({ name, type, description = '' }) => {
    // Any list request that started before this mutation is stale and must not
    // replace the newly created folder when it eventually resolves.
    requestSequence += 1
    saving.value = true
    error.value = ''
    try {
      const response = await practiceApi.createFolder({ name, type, description })
      const created = normalizeFolder({ name, type, description, attempts: [], ...unwrapApiResponse(response) })
      rememberFolderType(created.id, type)
      created.type = type
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
    const response = await practiceApi.updateFolder(id, { name })
    const target = folders.value.find((folder) => folder.id === String(id))
    if (target) target.name = unwrapApiResponse(response).name ?? name
    if (String(folderId.value) === String(id)) folderName.value = target?.name ?? name
    return target
  }

  const removeFolder = async (id) => {
    saving.value = true
    error.value = ''
    try {
      await practiceApi.deleteFolder(id)
      folders.value = folders.value.filter((folder) => String(folder.id) !== String(id))
      if (String(folderId.value) === String(id)) setFolder({ id: null, name: '' })
    } catch (requestError) {
      error.value = requestError?.message || '폴더를 삭제하지 못했습니다.'
      throw requestError
    } finally {
      saving.value = false
    }
  }

  const reset = () => {
    mode.value = null
    folderId.value = null
    folderName.value = ''
    folders.value = []
    error.value = ''
    clearRecentPractices()
    sessionStorage.removeItem(FLOW_KEY)
  }

  return {
    mode, folderId, folderName, folders, loading, saving, error,
    recentPractices, recentPracticeCount, recentPracticesLoading, recentPracticesError,
    setMode, setFolder, loadFolders, loadRecentPractices, clearRecentPractices,
    createFolder, renameFolder, removeFolder, reset,
  }
})
