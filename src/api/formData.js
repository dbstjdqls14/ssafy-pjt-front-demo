export const createFileFormData = (file, fields = {}) => {
  const formData = new FormData()
  formData.append('file', file)
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value))
  return formData
}

export const createJsonRequestFormData = (request, files = {}) => {
  const formData = new FormData()
  formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
  Object.entries(files).forEach(([key, file]) => {
    if (file) formData.append(key, file)
  })
  return formData
}

export const createRecordingFormData = ({ blob, metadata, fileName }) => {
  const formData = new FormData()
  if (blob) formData.append('recording', blob, fileName)
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  return formData
}
