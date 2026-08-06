const fallbackSuffix = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * Creates a namespaced local id for transient entities such as recordings and
 * transcript events. The prefix is retained even when randomUUID is available.
 */
export const createLocalId = (prefix = 'local') => {
  const suffix = globalThis.crypto?.randomUUID?.() ?? fallbackSuffix()
  return `${prefix}-${suffix}`
}

/**
 * Preserves the existing Store convention of using a raw UUID when available,
 * while still providing a readable prefix in older browsers.
 */
export const createOpaqueLocalId = (fallbackPrefix = 'local') => (
  globalThis.crypto?.randomUUID?.() ?? `${fallbackPrefix}-${fallbackSuffix()}`
)
