import { defineStore } from 'pinia'
import { ref } from 'vue'

import { archiveApi, readApiCollection, unwrapApiResponse } from '../api/index.js'
import {
  normalizeArchiveFolder,
  normalizeArchiveRecord as normalizeRecord,
  normalizeFolderDetail,
  normalizeFolderPracticeRow,
  normalizeScoreTrendPoint,
} from '../api/normalizers/archive.js'
import { LOCAL_STORAGE_KEYS } from '../constants/storageKeys.js'
import { archiveSessionMocks } from '../mocks/archive.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'

// Practice history archive. Stored in localStorage. The key is versioned so a
// schema change (e.g. adding slides/transcripts to seeded reports) re-seeds
// cleanly instead of leaving stale pre-refactor demo records around.
const HISTORY_KEY = LOCAL_STORAGE_KEYS.sessionHistory
const SEEDED_MOCK_IDS = new Set(archiveSessionMocks.map((item) => String(item.id)))

const loadSessions = () => {
  const stored = readJsonStorage(localStorage, HISTORY_KEY)
  if (!Array.isArray(stored)) return []

  // Older builds wrote demo reports into localStorage. Remove only those known
  // fixture ids while preserving sessions genuinely created in this browser.
  const sessions = stored.filter((item) => !SEEDED_MOCK_IDS.has(String(item?.id)))
  if (sessions.length !== stored.length) writeJsonStorage(localStorage, HISTORY_KEY, sessions)
  return sessions
}

const emptyFolderPage = (page = 0) => ({ totalElements: 0, currentPage: page, totalPage: 1, hasNext: false, folders: [] })
const emptyPracticePage = (page = 0) => ({ attemptCount: 0, currentPage: page, totalPages: 1, hasNext: false, practices: [] })

export const useArchiveStore = defineStore('archive', () => {
  // ── 개별 연습 기록(리포트) 캐시 — 폴더 API와 별개, 완료 직후 화면에서 채워진다 ──
  const sessions = ref(loadSessions())

  const add = (session) => {
    sessions.value = [session, ...sessions.value]
    writeJsonStorage(localStorage, HISTORY_KEY, sessions.value)
  }

  const find = (id) => sessions.value.find((item) => item.id === id) ?? null

  const loadRecord = async (id) => {
    const response = await archiveApi.getRecord(id)
    return response ? normalizeRecord(unwrapApiResponse(response)) : null
  }

  // ── 내 기록: 연습 폴더 전체 조회 (서버 페이지네이션) ──
  const folderPage = ref(emptyFolderPage())
  const foldersLoading = ref(false)
  const foldersError = ref('')
  let folderRequestSequence = 0

  const loadFolders = async ({ type = '', keyword = '', page = 0 } = {}) => {
    const sequence = ++folderRequestSequence
    foldersLoading.value = true
    foldersError.value = ''
    try {
      const response = await archiveApi.listFolders({ type, keyword, page })
      const value = unwrapApiResponse(response)
      const folders = readApiCollection(response, ['folders']).map(normalizeArchiveFolder)
      const totalElements = Number(value.totalElements ?? folders.length)

      const next = {
        totalElements,
        currentPage: Number(value.currentPage ?? page),
        totalPage: Number(value.totalPage ?? 1),
        hasNext: Boolean(value.hasNext),
        folders,
      }
      if (sequence === folderRequestSequence) folderPage.value = next
      return next
    } catch (requestError) {
      if (sequence === folderRequestSequence) foldersError.value = requestError?.message || '연습 폴더를 불러오지 못했습니다.'
      throw requestError
    } finally {
      if (sequence === folderRequestSequence) foldersLoading.value = false
    }
  }

  // ── 연습 폴더 상세 조회 (내기록) ──
  const folderDetail = ref(null)
  const folderDetailLoading = ref(false)
  const folderDetailError = ref('')

  const loadFolderDetail = async (folderId) => {
    folderDetailLoading.value = true
    folderDetailError.value = ''
    try {
      const response = await archiveApi.getFolderDetail(folderId)
      folderDetail.value = response ? normalizeFolderDetail(unwrapApiResponse(response)) : null
      return folderDetail.value
    } catch (requestError) {
      folderDetailError.value = requestError?.message || '폴더 정보를 불러오지 못했습니다.'
      throw requestError
    } finally {
      folderDetailLoading.value = false
    }
  }

  // ── 연습 폴더 점수 추이 조회 ──
  const scoreTrend = ref([])
  const scoreTrendLoading = ref(false)
  const scoreTrendError = ref('')

  const loadScoreTrend = async (folderId) => {
    scoreTrendLoading.value = true
    scoreTrendError.value = ''
    try {
      const response = await archiveApi.getFolderScoreTrend(folderId)
      scoreTrend.value = readApiCollection(response, ['scores']).map(normalizeScoreTrendPoint)
      return scoreTrend.value
    } catch (requestError) {
      scoreTrendError.value = requestError?.message || '점수 추이를 불러오지 못했습니다.'
      throw requestError
    } finally {
      scoreTrendLoading.value = false
    }
  }

  // ── 연습 폴더 연습 기록 조회 (서버 페이지네이션 + 정렬) ──
  const folderPractices = ref(emptyPracticePage())
  const folderPracticesLoading = ref(false)
  const folderPracticesError = ref('')
  let practicesRequestSequence = 0

  const loadFolderPractices = async (folderId, { page = 0, sort = 'latest' } = {}) => {
    const sequence = ++practicesRequestSequence
    folderPracticesLoading.value = true
    folderPracticesError.value = ''
    try {
      const response = await archiveApi.getFolderPractices(folderId, { page, sort })
      const value = unwrapApiResponse(response)
      const next = {
        attemptCount: Number(value.attemptCount ?? 0),
        currentPage: Number(value.currentPage ?? page),
        totalPages: Number(value.totalPages ?? 1),
        hasNext: Boolean(value.hasNext),
        practices: readApiCollection(response, ['practices']).map(normalizeFolderPracticeRow),
      }
      if (sequence === practicesRequestSequence) folderPractices.value = next
      return next
    } catch (requestError) {
      if (sequence === practicesRequestSequence) folderPracticesError.value = requestError?.message || '연습 기록을 불러오지 못했습니다.'
      throw requestError
    } finally {
      if (sequence === practicesRequestSequence) folderPracticesLoading.value = false
    }
  }

  return {
    sessions, add, find, loadRecord,
    folderPage, foldersLoading, foldersError, loadFolders,
    folderDetail, folderDetailLoading, folderDetailError, loadFolderDetail,
    scoreTrend, scoreTrendLoading, scoreTrendError, loadScoreTrend,
    folderPractices, folderPracticesLoading, folderPracticesError, loadFolderPractices,
  }
})
