export const parseServerId = (value) => {
  if (value === null || value === undefined || value === '') return null

  const text = String(value).trim()
  if (!/^[1-9]\d*$/.test(text)) return null

  const parsed = Number(text)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export const parseOptionalServerId = (value, label) => {
  if (value === null || value === undefined || value === '') return undefined

  const parsed = parseServerId(value)
  if (parsed === null) {
    const error = new Error(`${label} 정보가 실제 서버 데이터가 아니에요. 다시 선택해주세요.`)
    error.code = 'INVALID_SERVER_ID'
    throw error
  }
  return parsed
}

export const parseServerIdList = (values = [], label) => values.map((value) => {
  const parsed = parseOptionalServerId(value, label)
  if (parsed === undefined) {
    const error = new Error(`${label} 정보가 비어 있어요. 다시 선택해주세요.`)
    error.code = 'INVALID_SERVER_ID'
    throw error
  }
  return parsed
})
