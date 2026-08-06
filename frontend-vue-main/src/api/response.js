/**
 * Removes the optional transport envelope used by the backend client.
 * Stores can therefore normalize both mocked payloads and HTTP responses in
 * the same way.
 */
export const unwrapApiResponse = (response) => response?.data ?? response ?? {}

/**
 * Reads a collection using the first available backend field name.
 * Key order is intentional because it preserves each domain's existing
 * response precedence while keeping the transport detail out of Pinia stores.
 */
export const readApiCollection = (response, keys = []) => {
  const value = unwrapApiResponse(response)
  if (Array.isArray(value)) return value

  for (const key of keys) {
    if (value?.[key] != null) return value[key]
  }

  return []
}

export const readApiValue = (response, keys = [], fallback = null) => {
  const value = unwrapApiResponse(response)

  for (const key of keys) {
    if (value?.[key] != null) return value[key]
  }

  return fallback
}
