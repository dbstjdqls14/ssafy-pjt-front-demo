import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { interviewApi } from '../../src/api/interviewApi.js'
import { useInterviewStore } from '../../src/stores/interviewStore.js'
import InterviewQuestionsView from '../../src/views/interview/InterviewQuestionsView.vue'

const mountView = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const interview = useInterviewStore()
  interview.interviewId = 71
  interview.questions = [{ questionId: 1, text: '기존 질문', cat: '기본' }]
  vi.spyOn(interview, 'createInterview').mockResolvedValue({
    interviewId: 71,
    questions: interview.questions,
    reused: true,
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/interview/questions', component: InterviewQuestionsView },
      { path: '/interview/style', component: { template: '<div />' } },
      { path: '/interview/check', component: { template: '<div />' } },
      { path: '/interview/ready', component: { template: '<div />' } },
    ],
  })
  await router.push('/interview/questions')
  await router.isReady()
  const wrapper = mount(InterviewQuestionsView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, interview }
}

describe('InterviewQuestionsView text policy', () => {
  afterEach(() => vi.restoreAllMocks())

  test('keeps an invalid question visible with a grapheme counter and blocks the API', async () => {
    const addQuestion = vi.spyOn(interviewApi, 'addQuestion').mockResolvedValue({
      questionId: 2,
      question: '이 선택이 왜 필요한가요?',
    })
    const { wrapper } = await mountView()
    const question = wrapper.get('input[aria-label="질문 추가"]')

    expect(question.attributes('maxlength')).toBeUndefined()
    await question.setValue('질문👨‍👩‍👧‍👦')

    expect(question.element.value).toBe('질문👨‍👩‍👧‍👦')
    expect(wrapper.get('[data-testid="question-counter"]').text()).toBe('3/200')
    expect(wrapper.get('[data-testid="question-error"]').text()).toContain('이모지')

    await wrapper.get('.iv-question-add-ok').trigger('click')
    await flushPromises()
    expect(addQuestion).not.toHaveBeenCalled()

    await question.setValue('이 선택이 왜 필요한가요?')
    expect(wrapper.find('[data-testid="question-error"]').exists()).toBe(false)
    await wrapper.get('.iv-question-add-ok').trigger('click')
    await flushPromises()
    expect(addQuestion).toHaveBeenCalledWith(71, '이 선택이 왜 필요한가요?')
  })

  test('caps questions and accepts multilingual non-emoji text', async () => {
    const { wrapper } = await mountView()
    const question = wrapper.get('input[aria-label="질문 추가"]')

    await question.setValue('日'.repeat(201))
    expect(question.element.value).toBe('日'.repeat(200))
    expect(wrapper.get('[data-testid="question-counter"]').text()).toBe('200/200')

    await question.setValue('‘질문’ ··· 日本語 © ♥ ℃ →')
    expect(question.element.value).toBe('‘질문’ ··· 日本語 © ♥ ℃ →')
    expect(wrapper.find('[data-testid="question-error"]').exists()).toBe(false)
  })
})
