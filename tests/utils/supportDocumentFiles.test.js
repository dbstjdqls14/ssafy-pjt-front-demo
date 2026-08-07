import { describe, expect, test } from 'vitest'

import {
  MAX_SUPPORT_DOCUMENT_FILE_SIZE,
  validateSupportDocumentFile,
} from '../../src/utils/supportDocumentFiles.js'

describe('support document file validation', () => {
  test('accepts a PDF at the 50MB boundary', () => {
    expect(MAX_SUPPORT_DOCUMENT_FILE_SIZE).toBe(50 * 1024 * 1024)
    expect(validateSupportDocumentFile({
      name: 'resume.pdf',
      type: 'application/pdf',
      size: MAX_SUPPORT_DOCUMENT_FILE_SIZE,
    })).toBe('')
  })

  test('rejects unsupported, empty, and oversized files', () => {
    expect(validateSupportDocumentFile({ name: 'resume.docx', type: '', size: 10 })).toContain('PDF')
    expect(validateSupportDocumentFile({ name: 'resume.pdf', type: 'application/pdf', size: 0 })).toContain('내용이 없는')
    expect(validateSupportDocumentFile({
      name: 'resume.pdf',
      type: 'application/pdf',
      size: MAX_SUPPORT_DOCUMENT_FILE_SIZE + 1,
    })).toContain('50MB')
  })
})
