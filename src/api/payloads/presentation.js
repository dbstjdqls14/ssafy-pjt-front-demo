export const buildPresentationSessionPayload = (state, overrides = {}) => ({
  folderId: state.folderId,
  title: state.title,
  description: state.description,
  targetDurationSeconds: state.targetMinutes * 60,
  qnaEnabled: state.qnaEnabled,
  ...overrides,
})
