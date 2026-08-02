/**
 * Reads a JSON value without leaking malformed or unavailable browser storage
 * errors into store initialization.
 */
export const readJsonStorage = (storage, key, fallback = null) => {
  try {
    const raw = storage.getItem(key)
    return raw == null || raw === '' ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/**
 * Writes JSON using the browser Storage contract. Write failures intentionally
 * remain visible to callers, matching direct Storage#setItem behavior.
 */
export const writeJsonStorage = (storage, key, value) => {
  storage.setItem(key, JSON.stringify(value))
}

export const readBooleanStorage = (storage, key, fallback = false) => (
  readJsonStorage(storage, key, fallback) === true
)

export const writeBooleanStorage = (storage, key, value = true) => {
  try {
    writeJsonStorage(storage, key, Boolean(value))
    return true
  } catch {
    return false
  }
}
