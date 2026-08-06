import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { archiveApi } from '../../src/api/archiveApi.js'
import { interviewApi } from '../../src/api/interviewApi.js'
import { presentationApi } from '../../src/api/presentationApi.js'
import FolderDetailView from '../../src/views/archive/FolderDetailView.vue'

const mountView = async (type = 'presentation') => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/archive/folders/:id?', component: FolderDetailView },
      { path: '/archive/detail', component: { template: '<div />' } },
      { path: '/archive', component: { template: '<div />' } },
    ],
  })
  await router.push(`/archive/folders/41?type=${type}`)
  await router.isReady()
  const wrapper = mount(FolderDetailView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

describe('FolderDetailView real practices', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(archiveApi, 'getFolder').mockResolvedValue({
      folderId: 41,
      name: '서비스 발표',
      type: 'presentation',
      practiceCount: 1,
    })
    vi.spyOn(archiveApi, 'listPractices').mockResolvedValue({
      practices: [{
        practiceId: 35,
        presentationId: 12,
        title: 'AIVO 서비스 소개',
        description: '기능 소개',
        durationSec: 40,
        createdAt: '2026-07-20T14:32:00',
      }],
    })
    vi.spyOn(presentationApi, 'getReport').mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    vi.spyOn(interviewApi, 'getReport').mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
  })

  test('renders exactly the practices returned by Spring and keeps the presentation id', async () => {
    const wrapper = await mountView()

    expect(archiveApi.getFolder).toHaveBeenCalledWith('41', { type: 'presentation' })
    expect(archiveApi.listPractices).toHaveBeenCalledWith('41', { page: 0, sort: 'latest' })
    expect(wrapper.findAll('.attempt-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('총 1회')
    expect(wrapper.text()).toContain('AIVO 서비스 소개')
    const href = wrapper.get('.attempt-link').attributes('href')
    expect(href).toContain('presentationId=12')
    expect(href).toContain('id=35')
  })

  test('shows unavailable score states instead of a synthetic zero or seven-point history', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('점수 데이터 없음')
    expect(wrapper.text()).not.toContain('0점')
    expect(wrapper.findAll('.chart-point')).toHaveLength(0)
    expect(wrapper.findAll('.attempt-row')).toHaveLength(1)
  })

  test('fills a missing presentation list score from the real report response', async () => {
    presentationApi.getReport.mockResolvedValue({
      practice: { practiceId: 35 },
      presentation: { presentationId: 12 },
      score: { overallScore: 91 },
    })

    const wrapper = await mountView()

    expect(wrapper.get('.attempt-score').text()).toBe('91점')
    expect(wrapper.get('.folder-detail-metrics').text()).toContain('91점')
    expect(wrapper.findAll('.chart-point')).toHaveLength(1)
  })

  test('formats fractional report scores before rendering them', async () => {
    presentationApi.getReport.mockResolvedValue({
      practice: { practiceId: 35 },
      presentation: { presentationId: 12 },
      score: { overallScore: 91.666666666 },
    })

    const wrapper = await mountView()

    expect(wrapper.get('.attempt-score').text()).toBe('92점')
    expect(wrapper.get('.chart-score').text()).toBe('92점')
    expect(wrapper.text()).not.toContain('91.666666666')
  })

  test('does not invent an attempt ordinal or 0:00 duration when Spring omits them', async () => {
    archiveApi.listPractices.mockResolvedValue({
      practices: [{
        practiceId: 35,
        presentationId: 12,
        title: 'AIVO 서비스 소개',
        durationSec: null,
        createdAt: '2026-07-20T14:32:00',
      }],
    })

    const wrapper = await mountView()
    const row = wrapper.get('.attempt-row')

    expect(row.text()).toContain('녹화 시간 없음')
    expect(row.text()).not.toContain('0:00')
    expect(row.text()).not.toContain('1차')
  })

  test('opens an interview report with interviewId instead of practiceId', async () => {
    archiveApi.getFolder.mockResolvedValue({
      folderId: 41,
      name: '면접 폴더',
      type: 'interview',
      practiceCount: 2,
    })

    archiveApi.listPractices.mockResolvedValue({
      practices: [{
        practiceId: 35,
        interviewId: 21,
        type: 'interview',
        title: '백엔드 면접',
        durationSec: 95,
        createdAt: '2026-07-20T14:32:00',
      }],
    })

    const wrapper = await mountView('interview')

    expect(archiveApi.listPractices).toHaveBeenCalledWith('41', { page: 0, sort: 'latest' })
    expect(wrapper.findAll('.attempt-row')).toHaveLength(1)
    const href = wrapper.get('.attempt-link').attributes('href')
    expect(href).toContain('/interview/report/detail')
    expect(href).toContain('id=21')
    expect(href).not.toContain('id=35')
  })

  test('fills a missing interview list score from the real report response', async () => {
    archiveApi.getFolder.mockResolvedValue({
      folderId: 41,
      name: '면접 폴더',
      type: 'interview',
      practiceCount: 1,
    })
    archiveApi.listPractices.mockResolvedValue({
      practices: [{
        practiceId: 35,
        interviewId: 21,
        type: 'interview',
        title: '백엔드 면접',
        durationSec: 95,
        createdAt: '2026-07-20T14:32:00',
      }],
    })
    interviewApi.getReport.mockResolvedValue({ overallScore: 77 })

    const wrapper = await mountView('interview')

    expect(wrapper.get('.attempt-score').text()).toBe('77점')
    expect(wrapper.findAll('.chart-point')).toHaveLength(1)
  })

  test('disables only a report row whose domain id is missing', async () => {
    archiveApi.listPractices.mockResolvedValue({
      practices: [{ practiceId: 35, type: 'interview', title: 'ID 없는 면접' }],
    })
    archiveApi.getFolder.mockResolvedValue({ folderId: 41, name: '면접 폴더', type: 'interview' })

    const wrapper = await mountView('interview')

    expect(wrapper.find('a.attempt-link').exists()).toBe(false)
    expect(wrapper.get('.attempt-link.is-disabled').text()).toContain('리포트 ID 없음')
  })

  test('keeps long folder and practice titles inside their containers', async () => {
    const longFolderName = '폴더'.repeat(30)
    const longPracticeTitle = '발표 연습 제목'.repeat(20)
    archiveApi.getFolder.mockResolvedValue({ folderId: 41, name: longFolderName, type: 'presentation' })
    archiveApi.listPractices.mockResolvedValue({
      practices: [{ practiceId: 35, presentationId: 12, title: longPracticeTitle, type: 'presentation' }],
    })

    const wrapper = await mountView()

    expect(wrapper.get('#folderTitle').attributes('title')).toBe(longFolderName)
    expect(wrapper.get('.attempt-title').attributes('title')).toBe(longPracticeTitle)
  })
})
