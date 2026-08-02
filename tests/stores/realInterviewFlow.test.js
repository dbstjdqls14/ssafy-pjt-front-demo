import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { interviewApi, portfolioApi, practiceApi, resumeApi } from '../../src/api/index.js'
import { useInterviewStore } from '../../src/stores/interviewStore.js'
import { usePracticeStore } from '../../src/stores/practiceStore.js'

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
})

describe('real practice and interview flow', () => {
  test('does not replace a failed practice-folder API with demo folders', async () => {
    const failure = new TypeError('Failed to fetch')
    vi.spyOn(practiceApi, 'listFolders').mockRejectedValue(failure)
    const practice = usePracticeStore()

    await expect(practice.loadFolders({ type: 'interview' })).rejects.toBe(failure)
    expect(practice.folders).toEqual([])
    expect(practice.error).toBe('Failed to fetch')
  })

  test('clears a stale mock folder id restored from session storage', () => {
    sessionStorage.setItem('aivo.practice-flow', JSON.stringify({
      mode: 'interview',
      folderId: 'interview-backend',
      folderName: '백엔드 개발자 면접',
    }))

    const practice = usePracticeStore()

    expect(practice.folderId).toBeNull()
    expect(practice.folderName).toBe('')
  })

  test('normalizes real ids to numbers in the interview creation payload', async () => {
    const create = vi.spyOn(interviewApi, 'create').mockResolvedValue({
      interviewId: 7,
      questionItems: [{ questionId: 11, question: '프로젝트 역할을 설명해주세요.' }],
    })
    const practice = usePracticeStore()
    practice.setFolder({ id: '12', name: '백엔드 면접' })
    const interview = useInterviewStore()
    interview.setInfo({
      title: '실전 면접',
      companyId: '1',
      occupationId: '3',
      jobId: '190',
      careerLevel: '4년 이상',
    })
    interview.setInterviewer({ id: '2', code: 'PRACTICAL' })
    interview.setResumeSelection([{ id: '2', title: '자기소개서' }])

    await interview.createInterview()

    expect(create).toHaveBeenCalledWith({
      companyId: 1,
      occupationId: 3,
      jobId: 190,
      workExperience: '4년 이상',
      title: '실전 면접',
      folderId: 12,
      portfolioIds: [],
      resumeIds: [2],
      interviewerId: 2,
    })
    expect(interview.questions[0].text).toBe('프로젝트 역할을 설명해주세요.')
  })

  test('blocks a stale mock folder id before calling the real interview API', async () => {
    const create = vi.spyOn(interviewApi, 'create')
    const practice = usePracticeStore()
    practice.folderId = 'interview-backend'
    const interview = useInterviewStore()

    await expect(interview.createInterview()).rejects.toMatchObject({ code: 'INVALID_SERVER_ID' })
    expect(create).not.toHaveBeenCalled()
  })

  test('uses practiceId for ten-second interview audio analysis', async () => {
    const analyze = vi.spyOn(interviewApi, 'analyzeAudio').mockResolvedValue({
      practiceId: 31,
      sequence: 0,
    })
    const interview = useInterviewStore()
    interview.interviewId = 7
    interview.practiceId = 31
    const blob = new Blob(['wav'], { type: 'audio/wav' })

    await interview.analyzeAnswerAudio({ blob, sequence: 0 })

    expect(analyze).toHaveBeenCalledWith(31, { blob, sequence: 0 })
  })

  test('restores questions and loads the latest per-question feedback', async () => {
    vi.spyOn(interviewApi, 'getQuestions').mockResolvedValue([
      { questionId: 11, question: '프로젝트 역할을 설명해주세요.' },
    ])
    vi.spyOn(interviewApi, 'getQuestionFeedback').mockResolvedValue({
      questionId: 11,
      feedback: '성과를 수치로 설명해보세요.',
    })
    const interview = useInterviewStore()
    interview.interviewId = 7

    await interview.loadQuestions()
    await interview.loadQuestionFeedback(11)

    expect(interview.questions).toEqual([
      expect.objectContaining({ questionId: 11, text: '프로젝트 역할을 설명해주세요.' }),
    ])
    expect(interview.questionFeedbacks[11]).toEqual(expect.objectContaining({
      feedback: '성과를 수치로 설명해보세요.',
    }))
  })

  test('deletes resume and portfolio files from the server catalog and selection', async () => {
    const removeResume = vi.spyOn(resumeApi, 'remove').mockResolvedValue(undefined)
    const removePortfolio = vi.spyOn(portfolioApi, 'remove').mockResolvedValue(undefined)
    const interview = useInterviewStore()
    interview.resumeCatalog = [{ id: 2, title: '자기소개서' }]
    interview.portfolioCatalog = [{ id: 3, title: '포트폴리오' }]
    interview.setResumeSelection(interview.resumeCatalog)
    interview.setPortfolioSelection(interview.portfolioCatalog)

    await interview.deleteResumeDoc(2)
    await interview.deletePortfolioDoc(3)

    expect(removeResume).toHaveBeenCalledWith(2)
    expect(removePortfolio).toHaveBeenCalledWith(3)
    expect(interview.resumeCatalog).toEqual([])
    expect(interview.portfolioCatalog).toEqual([])
    expect(interview.resumeDocs).toEqual([])
    expect(interview.portfolioDocs).toEqual([])
  })
})
