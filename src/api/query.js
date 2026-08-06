const hasQueryValue = (value) => value !== '' && value !== undefined && value !== null

export const withQuery = (path, params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => hasQueryValue(value)),
  ).toString()

  return query ? `${path}?${query}` : path
}
