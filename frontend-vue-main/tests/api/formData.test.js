import { describe, expect, it } from 'vitest'

import { createFileFormData, createRecordingFormData } from '../../src/api/formData.js'

describe('API FormData helpers', () => {
  it('creates file uploads with additional fields', () => {
    const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' })
    const formData = createFileFormData(file, { type: 'resume' })

    expect(formData.get('file')).toBe(file)
    expect(formData.get('type')).toBe('resume')
  })

  it('creates recording uploads with JSON metadata', async () => {
    const recording = new Blob(['video'], { type: 'video/webm' })
    const formData = createRecordingFormData({
      blob: recording,
      metadata: { durationSeconds: 30 },
      fileName: 'presentation-session.webm',
    })

    expect(formData.get('recording')).toBeInstanceOf(File)
    expect(formData.get('recording').name).toBe('presentation-session.webm')
    expect(formData.get('metadata').type).toBe('application/json')
    expect(await formData.get('metadata').text()).toBe('{"durationSeconds":30}')
  })

  it('allows metadata-only recording requests', () => {
    const formData = createRecordingFormData({ metadata: {}, fileName: 'unused.webm' })
    expect(formData.has('recording')).toBe(false)
    expect(formData.has('metadata')).toBe(true)
  })
})
