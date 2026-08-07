import { describe, expect, it } from 'vitest'

import { buildInterviewSessionPayload } from '../../src/api/payloads/interview.js'
import { buildPresentationSessionPayload } from '../../src/api/payloads/presentation.js'

describe('API session payload builders', () => {
  it('maps presentation state to the backend session contract', () => {
    expect(buildPresentationSessionPayload({
      folderId: 'folder-1',
      title: 'Service introduction',
      description: 'Demo presentation',
      targetMinutes: 7,
      qnaEnabled: true,
    }, { status: 'RECORDING' })).toEqual({
      folderId: 'folder-1',
      title: 'Service introduction',
      description: 'Demo presentation',
      targetDurationSeconds: 420,
      qnaEnabled: true,
      status: 'RECORDING',
    })
  })

  it('maps interview state and lets explicit overrides win', () => {
    const questions = [{ questionId: 1, text: 'Introduce yourself' }]
    expect(buildInterviewSessionPayload({
      folderId: 'folder-2',
      title: 'Backend interview',
      company: 'AIVO',
      field: 'Software',
      position: 'Backend developer',
      careerLevel: 'Junior',
      keywords: ['Java'],
      resumeDocs: [{ id: 'resume-1' }],
      interviewerStyle: 'practical',
      questions,
    }, { interviewerStyle: 'pressure', status: 'DRAFT' })).toEqual({
      folderId: 'folder-2',
      title: 'Backend interview',
      company: 'AIVO',
      field: 'Software',
      position: 'Backend developer',
      careerLevel: 'Junior',
      keywords: ['Java'],
      resumeDocuments: [{ id: 'resume-1' }],
      interviewerStyle: 'pressure',
      questions,
      status: 'DRAFT',
    })
  })
})
