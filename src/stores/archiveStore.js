import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  archiveApi,
  interviewApi,
  practiceApi,
  presentationApi,
  readApiCollection,
  unwrapApiResponse,
} from '../api/index.js'
import {
  normalizeArchivePractice,
  normalizePracticeFolder,
} from '../api/normalizers/practice.js'
import { LOCAL_STORAGE_KEYS } from '../constants/storageKeys.js'
import { readJsonStorage, writeJsonStorage } from '../utils/storage.js'

// 면접 리포트 상세가 기존 세션 ID를 찾는 용도로만 유지한다. 내 기록 목록에는 노출하지 않는다.
const HISTORY_KEY = LOCAL_STORAGE_KEYS.sessionHistory

const loadSessions = () => {
  const stored = readJsonStorage(localStorage, HISTORY_KEY)
  return Array.isArray(stored) ? stored : []
}

const folderItems = (response) => readApiCollection(response, ['folders', 'items', 'content'])
const practiceItems = (response) => readApiCollection(response, ['practices', 'items', 'content'])
const nullableScore = (value) => {
  if (value == null || value === '') return null
  const score = Number(value)
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null
}

const reportScore = (response, type) => {
  const report = unwrapApiResponse(response) ?? {}
  return type === 'interview'
    ? nullableScore(report.overallScore ?? report.score?.overallScore)
    : nullableScore(report.score?.overallScore ?? report.overallScore)
}

// 목록 점수는 리포트 상세가 보여주는 총점과 반드시 같아야 한다. 목록 API가 주는
// score가 총점이 아닌 경우(내용 점수만 담겨 오는 등)에 "목록 12점 / 상세 20점"처럼
// 어긋나 보였다 → 리포트를 읽을 수 있으면 리포트의 총점으로 덮어쓴다.
const hydratePracticeScore = async (practice) => {
  const domainId = practice.type === 'interview'
    ? practice.interviewId
    : practice.presentationId
  if (domainId == null) return practice

  try {
    const response = practice.type === 'interview'
      ? await interviewApi.getReport(domainId)
      : await presentationApi.getReport(domainId)
    const score = reportScore(response, practice.type)
    // 리포트에 총점이 없으면(아직 생성 중 등) 목록 값을 그대로 둔다.
    return score == null ? practice : { ...practice, score }
  } catch {
    // 개별 리포트가 아직 생성되지 않은 연습은 목록 값을 그대로 표시한다.
    return practice
  }
}

export const useArchiveStore = defineStore('archive', () => {
  const sessions = ref(loadSessions())
  const folders = ref([])
  const pagination = ref({
    totalElements: 0,
    currentPage: 0,
    totalPage: 0,
    hasNext: false,
  })
  const selectedFolder = ref(null)
  const practices = ref([])
  const loading = ref(false)
  const error = ref('')
  let requestSequence = 0

  const clearServerState = () => {
    folders.value = []
    pagination.value = {
      totalElements: 0,
      currentPage: 0,
      totalPage: 0,
      hasNext: false,
    }
    selectedFolder.value = null
    practices.value = []
  }

  const add = (session) => {
    sessions.value = [session, ...sessions.value]
    writeJsonStorage(localStorage, HISTORY_KEY, sessions.value)
  }

  const find = (id) => sessions.value.find((item) => item.id === id) ?? null
  const folderById = (id) => folders.value.find((folder) => folder.id === String(id)) ?? null
  const folderByTitle = (title) => folders.value.find((folder) => folder.name === title) ?? null

  const loadFolders = async (params = {}) => {
    const sequence = ++requestSequence
    loading.value = true
    error.value = ''
    try {
      const response = await archiveApi.listFolders(params)
      const payload = unwrapApiResponse(response) ?? {}
      const next = folderItems(response)
        .map(normalizePracticeFolder)
        .filter((folder) => folder.id && folder.id !== 'undefined')
      if (sequence === requestSequence) {
        folders.value = next
        pagination.value = {
          totalElements: Number(payload.totalElements ?? next.length) || 0,
          currentPage: Number(payload.currentPage ?? params.page ?? 0) || 0,
          totalPage: Number(payload.totalPage ?? (next.length ? 1 : 0)) || 0,
          hasNext: Boolean(payload.hasNext),
        }
      }
      return next
    } catch (requestError) {
      if (sequence === requestSequence) {
        clearServerState()
        error.value = requestError?.message || '연습 폴더를 불러오지 못했습니다.'
      }
      throw requestError
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  const loadFolder = async (id, params = {}) => {
    loading.value = true
    error.value = ''
    try {
      const response = await archiveApi.getFolder(id, params)
      selectedFolder.value = normalizePracticeFolder(unwrapApiResponse(response))
      return selectedFolder.value
    } catch (requestError) {
      error.value = requestError?.message || '연습 폴더 정보를 불러오지 못했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  const loadPractices = async (folderId, params = { page: 0, sort: 'latest' }) => {
    loading.value = true
    error.value = ''
    try {
      const response = await archiveApi.listPractices(folderId, params)
      const normalizedPractices = practiceItems(response).map(normalizeArchivePractice)
      practices.value = await Promise.all(normalizedPractices.map(hydratePracticeScore))
      return practices.value
    } catch (requestError) {
      error.value = requestError?.message || '연습 기록을 불러오지 못했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  const removeFolder = async (folderId) => {
    if (folderId == null || folderId === '') return false

    await practiceApi.deleteFolder(folderId)
    const normalizedId = String(folderId)
    folders.value = folders.value.filter((folder) => String(folder.id) !== normalizedId)
    pagination.value = {
      ...pagination.value,
      totalElements: Math.max(0, Number(pagination.value.totalElements || 0) - 1),
    }
    if (String(selectedFolder.value?.id ?? '') === normalizedId) {
      selectedFolder.value = null
      practices.value = []
    }
    return true
  }

  return {
    sessions,
    folders,
    pagination,
    selectedFolder,
    practices,
    loading,
    error,
    add,
    find,
    folderById,
    folderByTitle,
    loadFolders,
    loadFolder,
    loadPractices,
    removeFolder,
  }
})
