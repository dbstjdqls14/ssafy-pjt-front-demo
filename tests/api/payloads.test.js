import { describe, expect, it } from 'vitest'

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
})
