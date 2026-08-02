import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useInterviewStore } from '../../src/stores/interviewStore.js'
import InterviewReportDetailView from '../../src/views/interview/InterviewReportDetailView.vue'

describe('InterviewReportDetailView real report fields', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('renders the summary, expands detailed feedback, and uses index-based evidence without demo fallbacks', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const answer = '저는 응답 시간을 30% 줄였습니다.'
    const evidenceText = '응답 시간을 30% 줄였습니다'
    const interview = useInterviewStore()
    interview.report = {
      interviewId: 21,
      title: '삼성전자 백엔드 면접',
      description: '2026 상반기 백엔드 직무 대비',
      durationSeconds: 40,
      overallScore: 88,
      metrics: { voiceScore: 86, videoScore: 82, contentScore: 91 },
      scoreCards: [],
      contentEvaluation: {
        relevanceScore: 90,
        structureScore: 85,
        clarityScore: 88,
        deliveryScore: 86,
        summary: '답변 구조가 명확합니다.',
      },
      strengths: ['정량적인 성과를 제시했습니다.'],
      improvements: ['협업 과정을 더 설명해보세요.'],
      detailedFeedback: '전반적으로 근거가 분명한 답변입니다.',
      questionEvaluations: [{
        questionId: 'q-1',
        question: '성과를 설명해주세요.',
        answer,
        score: 89,
        durationSeconds: 40,
        evidence: [{
          type: 'strength',
          text: evidenceText,
          startIndex: answer.indexOf(evidenceText),
          endIndex: answer.indexOf(evidenceText) + evidenceText.length,
          reason: '정량적 성과를 제시한 부분입니다.',
        }],
      }],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('2026 상반기 백엔드 직무 대비')
    expect(wrapper.findAll('.archive-report-meta dd')[0].text()).toMatch(/^\d{4}\.\d{2}\.\d{2}$/)
    expect(wrapper.text()).toContain('답변 구조가 명확합니다.')
    expect(wrapper.find('#overallFeedbackDetails').isVisible()).toBe(false)
    await wrapper.get('.iv-overall-toggle').trigger('click')
    expect(wrapper.get('.iv-overall-toggle').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#overallFeedbackDetails').attributes('style')).not.toContain('display: none')
    expect(wrapper.text()).toContain('정량적인 성과를 제시했습니다.')
    expect(wrapper.text()).toContain('전반적으로 근거가 분명한 답변입니다.')
    expect(wrapper.get('.iv-evidence-mark.is-strength').text()).toContain(evidenceText)
    expect(wrapper.get('.iv-evidence-tooltip').text()).toContain('정량적 성과를 제시한 부분입니다.')
    expect(wrapper.text()).not.toContain('최근 평균 대비 +5점')
  })

  it('renames the video score card to gesture and removes facial anomaly metrics', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/report/detail', component: InterviewReportDetailView },
        { path: '/archive/folders', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/report/detail')
    await router.isReady()

    const interview = useInterviewStore()
    interview.report = {
      title: '면접 리포트',
      overallScore: 70,
      scoreCards: [{
        label: '영상',
        score: 80,
        metrics: [
          { label: '시선 이탈', value: '11회' },
          { label: '표정 이상 감지', value: '0회' },
          { label: '자세 기울기', value: '12%' },
        ],
      }],
      questionEvaluations: [
        {
          questionId: 'q-1',
          question: '첫 번째 질문',
          answer: '첫 번째 답변',
          durationSeconds: 10,
          gestureSeries: {
            gazeCount: 4,
            gazeEvents: [{ atSec: 2 }, { atSec: 4 }, { atSec: 6 }, { atSec: 8 }],
            buckets: [{ startSec: 0, endSec: 10, tiltPct: 17.84016393442623 }],
          },
        },
        {
          questionId: 'q-2',
          question: '두 번째 질문',
          answer: '두 번째 답변',
          durationSeconds: 10,
          gestureSeries: {
            gazeCount: 6,
            gazeEvents: [],
            buckets: [{ startSec: 0, endSec: 10, tiltPct: 10 }],
          },
        },
      ],
    }

    const wrapper = mount(InterviewReportDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('.archive-score-metric > dt').text()).toContain('몸짓')
    expect(wrapper.get('.archive-score-detail').text()).toContain('몸짓 평가 지표')
    expect(wrapper.get('.archive-score-detail').text()).toContain('시선 이탈10회')
    expect(wrapper.get('.archive-score-detail').text()).not.toContain('시선 이탈11회')
    expect(wrapper.get('.archive-score-detail').text()).not.toContain('표정 이상 감지')
  })
})
