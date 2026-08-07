export const buildInterviewSessionPayload = (state, overrides = {}) => ({
  folderId: state.folderId,
  title: state.title,
  company: state.company,
  field: state.field,
  position: state.position,
  careerLevel: state.careerLevel,
  keywords: state.keywords,
  resumeDocuments: state.resumeDocs,
  interviewerStyle: state.interviewerStyle,
  questions: state.questions,
  ...overrides,
})
