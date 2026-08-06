import { isApiUnavailableError } from './client.js'

// Try the real backend first and use local fixtures only when the endpoint is
// genuinely unavailable. Authentication, authorization, validation, and other
// application errors must reach the caller instead of being hidden by a mock.
export const withMock = async (request, mock) => {
  try {
    return await request()
  } catch (error) {
    if (!isApiUnavailableError(error)) {
      throw error
    }

    if (import.meta.env?.DEV) {
      console.info('[AIVO] API unavailable - using mock fallback:', error?.message ?? error)
    }
    return typeof mock === 'function' ? mock() : mock
  }
}
