import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { archiveApi, readApiCollection, unwrapApiResponse } from '../api/index.js'
import { normalizeArchiveRecord as normalizeRecord } from '../api/normalizers/archive.js'
import { withMock } from '../api/withMock.js'
import { LOCAL_STORAGE_KEYS } from '../constants/storageKeys.js'
import { archiveSessionMocks } from '../mocks/archive.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'

// Practice history archive. Stored in localStorage. The key is versioned so a
// schema change (e.g. adding slides/transcripts to seeded reports) re-seeds
// cleanly instead of leaving stale pre-refactor demo records around.
const HISTORY_KEY = LOCAL_STORAGE_KEYS.sessionHistory

const parseDate = (item) => {
  const [y, m, d] = String(item.date).split('.').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const loadSessions = () => {
  const stored = readJsonStorage(localStorage, HISTORY_KEY)
  if (Array.isArray(stored) && stored.length) return stored
  writeJsonStorage(localStorage, HISTORY_KEY, archiveSessionMocks)
  return archiveSessionMocks.map((item) => ({ ...item }))
}

const responseItems = (response) => readApiCollection(response, ['items', 'records', 'content', 'reports'])
const matchesParams = (item, params) => {
  const type = params.type
  const keyword = String(params.keyword ?? '').trim().toLocaleLowerCase('ko-KR')
  return (!type || type === 'all' || item.type === type)
    && (!keyword || item.title.toLocaleLowerCase('ko-KR').includes(keyword))
}

export const useArchiveStore = defineStore('archive', () => {
  const sessions = ref(loadSessions())
  const loading = ref(false)
  const error = ref('')
  let requestSequence = 0

  const add = (session) => {
    sessions.value = [session, ...sessions.value]
    writeJsonStorage(localStorage, HISTORY_KEY, sessions.value)
  }

  const find = (id) => sessions.value.find((item) => item.id === id) ?? null

  // Group attempts by folder title, newest folder first.
  const folders = computed(() => {
    const map = new Map()
    for (const item of sessions.value) {
      if (!map.has(item.title)) map.set(item.title, { title: item.title, type: item.type, attempts: [] })
      map.get(item.title).attempts.push(item)
    }
    return [...map.values()]
      .map((folder) => {
        const sorted = [...folder.attempts].sort((a, b) => parseDate(b) - parseDate(a))
        return {
          ...folder,
          latest: sorted[0],
          count: folder.attempts.length,
          best: Math.max(...folder.attempts.map((a) => a.score)),
        }
      })
      .sort((a, b) => parseDate(b.latest) - parseDate(a.latest))
  })

  const folderByTitle = (title) => folders.value.find((f) => f.title === title) ?? null

  const loadRecords = async (params = {}) => {
    const sequence = ++requestSequence
    loading.value = true
    error.value = ''
    try {
      const response = await withMock(
        () => archiveApi.listRecords(params),
        () => ({ records: loadSessions().filter((item) => matchesParams(item, params)) }),
      )
      const next = responseItems(response).map(normalizeRecord)
      if (sequence === requestSequence) sessions.value = next
      return next
    } catch (requestError) {
      if (sequence === requestSequence) error.value = requestError?.message || '연습 기록을 불러오지 못했습니다.'
      throw requestError
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  const loadRecord = async (id) => {
    const cached = find(id)
    const response = await withMock(() => archiveApi.getRecord(id), () => cached)
    return response ? normalizeRecord(unwrapApiResponse(response)) : null
  }

  const loadFolder = async (id) => withMock(
    () => archiveApi.getFolder(id),
    () => folders.value.find((folder) => String(folder.folderId) === String(id)) ?? null,
  )

  return { sessions, folders, loading, error, add, find, folderByTitle, loadRecords, loadRecord, loadFolder }
})
