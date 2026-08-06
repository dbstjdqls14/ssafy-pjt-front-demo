export const createFileFormData = (file, fields = {}) => {
  const formData = new FormData()
  formData.append('file', file)
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value))
  return formData
}

export const createRecordingFormData = ({ blob, metadata, fileName }) => {
  const formData = new FormData()
  if (blob) formData.append('recording', blob, fileName)
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  return formData
}
