import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  portfolioApi,
  readApiCollection,
  resumeApi,
  unwrapApiResponse,
} from '../api/index.js'
import {
  mergeSupportDocuments,
  normalizePortfolioDocument,
  normalizeResumeDocument,
  parseSupportDocumentId,
} from '../api/normalizers/documents.js'
import { validateSupportDocumentFile } from '../utils/supportDocumentFiles.js'

const resumeItems = (response) => readApiCollection(response, ['resumes', 'items', 'content'])
const portfolioItems = (response) => readApiCollection(response, ['portfolios', 'items', 'content'])

export const useDocumentsStore = defineStore('documents', () => {
  const resumes = ref([])
  const portfolios = ref([])
  const loading = ref(false)
  const error = ref('')

  const documents = computed(() => mergeSupportDocuments(resumes.value, portfolios.value))
  const count = computed(() => documents.value.length)
  const find = (id) => documents.value.find((item) => item.id === String(id)) ?? null

  const refreshResumes = async () => {
    resumes.value = resumeItems(await resumeApi.list())
    return resumes.value
  }

  const refreshPortfolios = async () => {
    portfolios.value = portfolioItems(await portfolioApi.list())
    return portfolios.value
  }

  const loadDocuments = async () => {
    loading.value = true
    error.value = ''
    try {
      const [resumeResult, portfolioResult] = await Promise.allSettled([
        resumeApi.list(),
        portfolioApi.list(),
      ])

      if (resumeResult.status === 'fulfilled') {
        resumes.value = resumeItems(resumeResult.value)
      }
      if (portfolioResult.status === 'fulfilled') {
        portfolios.value = portfolioItems(portfolioResult.value)
      }

      const resumeFailed = resumeResult.status === 'rejected'
      const portfolioFailed = portfolioResult.status === 'rejected'
      if (resumeFailed) resumes.value = []
      if (portfolioFailed) portfolios.value = []
      if (resumeFailed && portfolioFailed) {
        error.value = '자소서와 포트폴리오 자료를 불러오지 못했습니다.'
        throw resumeResult.reason
      }
      if (resumeFailed) error.value = '자소서 목록을 불러오지 못했습니다. 포트폴리오 자료만 표시합니다.'
      if (portfolioFailed) error.value = '포트폴리오 목록을 불러오지 못했습니다. 자소서 자료만 표시합니다.'
      return documents.value
    } catch (requestError) {
      if (!error.value) error.value = '지원 자료를 불러오지 못했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  const loadDocument = async (id) => {
    const parsed = parseSupportDocumentId(id)
    if (!parsed) return null

    loading.value = true
    error.value = ''
    try {
      if (parsed.type === 'resume') {
        const item = unwrapApiResponse(await resumeApi.get(parsed.serverId))
        return normalizeResumeDocument(item)
      }
      const item = unwrapApiResponse(await portfolioApi.get(parsed.serverId))
      return normalizePortfolioDocument(item)
    } catch (requestError) {
      error.value = '지원 자료를 불러오지 못했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  const uploadDocument = async ({ type, title, file }) => {
    if (type !== 'resume' && type !== 'portfolio') throw new Error('지원 자료 유형이 올바르지 않습니다.')
    const fileValidationError = validateSupportDocumentFile(file)
    if (fileValidationError) throw new Error(fileValidationError)

    loading.value = true
    error.value = ''
    try {
      if (type === 'resume') {
        await resumeApi.upload({ title, file })
        await refreshResumes()
      } else {
        await portfolioApi.upload({ title, file })
        await refreshPortfolios()
      }
      return documents.value.find((item) => item.type === type) ?? null
    } catch (requestError) {
      error.value = '지원 자료를 등록하지 못했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  const removeDocument = async (id) => {
    const parsed = parseSupportDocumentId(id)
    if (!parsed) return false

    loading.value = true
    error.value = ''
    try {
      if (parsed.type === 'resume') {
        await resumeApi.remove(parsed.serverId)
        resumes.value = resumes.value.filter((item) => Number(item.id ?? item.resumeId) !== Number(parsed.serverId))
      } else {
        await portfolioApi.remove(parsed.serverId)
        portfolios.value = portfolios.value.filter((item) => Number(item.id ?? item.portfolioId) !== Number(parsed.serverId))
      }
      return true
    } catch (requestError) {
      error.value = '지원 자료를 삭제하지 못했습니다.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  return {
    resumes,
    portfolios,
    documents,
    loading,
    error,
    count,
    find,
    loadDocuments,
    loadDocument,
    uploadDocument,
    removeDocument,
  }
})
