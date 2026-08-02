import { setMockStatus } from '../utils/mockStatus.js'

// Mock fallback is intentionally disabled. Keep this wrapper temporarily so
// existing callers do not need a risky all-at-once rewrite: every request now
// succeeds with the real server response or rejects with the real API error.
export const withMock = async (request, _mock, label) => {
  try {
    const result = await request()
    setMockStatus(label, false)
    return result
  } catch (error) {
    setMockStatus(label, false)
    throw error
  }
}
