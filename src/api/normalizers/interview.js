export const normalizeInterviewQuestion = (question, index = 0) => ({
  questionId: question.questionId ?? question.id ?? `question-${index + 1}`,
  text: question.text ?? question.question ?? question.content ?? '',
  cat: question.cat ?? question.category ?? '공통',
  min: Number(question.min ?? question.estimatedMinutes ?? 2),
})

export const normalizeInterviewQuestions = (questions = []) => questions
  .map(normalizeInterviewQuestion)
  .filter((question) => question.text)
