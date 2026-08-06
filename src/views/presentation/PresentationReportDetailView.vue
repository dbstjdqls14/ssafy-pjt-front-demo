<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import PresentationReportAnalysis from '../../components/presentation-report/PresentationReportAnalysis.vue'
import PresentationReportSummary from '../../components/presentation-report/PresentationReportSummary.vue'
import PresentationReportVideoPanel from '../../components/presentation-report/PresentationReportVideoPanel.vue'
import { usePresentationReportVideo } from '../../composables/usePresentationReportVideo.js'
import { parseServerId } from '../../api/serverId.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import { isUnmeasuredPresentationSlide } from '../../utils/presentationReportSlides.js'
import '../../assets/styles/views/presentation-report.css'

const route = useRoute()
const presentationStore = usePresentationStore()
const loading = ref(true)
const errorMessage = ref('')
const selectedIndex = ref(0)
const activeMetric = ref('voice')

const report = computed(() => presentationStore.report)
const slides = computed(() => report.value?.slides ?? [])
const selectedSlide = computed(() => slides.value[selectedIndex.value] ?? null)
const videoUrl = computed(() => report.value?.media?.video?.playbackUrl ?? '')
const videoMediaKey = computed(() => [
  presentationId.value ?? 'none',
  report.value?.media?.video?.videoId ?? 'none',
  videoUrl.value,
].join(':'))
const isUnmeasuredSlide = isUnmeasuredPresentationSlide
const selectedSlideUnmeasured = computed(() => isUnmeasuredSlide(selectedSlide.value))
const selectedSlideTranscript = computed(() => (selectedSlide.value?.transcriptSegments ?? [])
  .map((segment) => String(segment.text ?? '').trim())
  .filter(Boolean)
  .join(' '))

// 질의응답 피드백은 몇 번 질문에 답했는지 함께 보여준다(Q1, Q2 …).
const answeredQuestionAnswers = computed(() => (report.value?.questionAnswers ?? [])
  .map((item, index) => ({ ...item, code: `Q${index + 1}` }))
  .filter((item) => String(item.userAnswer ?? '').trim()))
const hasQuestionAnswerSection = computed(() => (
  report.value?.presentation?.aiQnaEnabled === true
  || (report.value?.questionAnswers ?? []).length > 0
))
const controller = usePresentationReportVideo({ slides, selectedIndex })

const presentationId = computed(() => parseServerId(
  route.query.presentationId
  ?? route.params.id
  ?? presentationStore.sessionId,
))
const returnFolderId = computed(() => parseServerId(route.query.folderId))
const returnFolderLocation = computed(() => (
  returnFolderId.value === null
    ? '/archive'
    : { path: `/archive/folders/${returnFolderId.value}`, query: { type: 'presentation' } }
))

const selectSlide = (index) => {
  if (isUnmeasuredSlide(slides.value[index])) return
  activeMetric.value = 'voice'
  controller.selectSlide(index)
}

watch(presentationId, async (nextPresentationId, _previousPresentationId, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })
  loading.value = true
  errorMessage.value = ''
  selectedIndex.value = 0
  activeMetric.value = 'voice'
  controller.reset()
  try {
    if (presentationId.value === null) throw new Error('발표 리포트를 조회할 발표 ID가 없습니다.')
    await presentationStore.loadReport(nextPresentationId)
  } catch (error) {
    if (cancelled) return
    errorMessage.value = error?.message || '발표 리포트를 불러오지 못했습니다.'
  } finally {
    if (cancelled) return
    loading.value = false
  }
}, { immediate: true })
</script>

<template>
  <!-- archive-report-shell / metric-report-shell: 점수 카드 호버와 음성·몸짓 그래프
       디자인을 면접 리포트와 공유하기 위한 스코프 클래스 -->
  <main class="pr-page archive-report-shell metric-report-shell">
    <!-- 뒤로가기도 면접 리포트와 같은 스타일(.archive-report-back, 화살표는 CSS) -->
    <RouterLink class="pr-back archive-report-back" :to="returnFolderLocation">폴더 상세로 돌아가기</RouterLink>

    <p v-if="loading" class="pr-state">발표 리포트를 불러오는 중입니다.</p>
    <section v-else-if="errorMessage" class="pr-state is-error" role="alert">
      <strong>발표 리포트를 표시할 수 없습니다.</strong>
      <p>{{ errorMessage }}</p>
    </section>

    <template v-else-if="report">
      <PresentationReportSummary
        :practice="report.practice"
        :presentation="report.presentation"
        :score="report.score"
        :slides="slides"
      />

      <!-- 면접 리포트와 같은 순서·구획: 상단 연습 정보/점수 → 구분선 → 그래프 -->
      <div class="iv-section-divider" aria-hidden="true"></div>

      <PresentationReportAnalysis
        v-if="selectedSlide"
        :slide="selectedSlide"
        :active-metric="activeMetric"
        :active-local-sec="controller.localSec.value"
        @update:active-metric="activeMetric = $event"
        @seek-local="controller.seekLocal"
      />

      <PresentationReportVideoPanel
        :slides="slides"
        :selected-index="selectedIndex"
        :video-url="videoUrl"
        :media-key="videoMediaKey"
        :controller="controller"
      />

      <section class="pr-feedback" aria-labelledby="presentation-slide-feedback-title">
        <header>
          <h2 id="presentation-slide-feedback-title">슬라이드 내용 피드백</h2>
          <p>슬라이드별 AI 피드백을 확인하세요.</p>
        </header>
        <div class="pr-feedback-layout">
          <nav aria-label="슬라이드 피드백 목록">
            <button
              v-for="(slide, index) in slides"
              :key="slide.slideId"
              type="button"
              :class="{ 'is-active': index === selectedIndex, 'is-unmeasured': isUnmeasuredSlide(slide) }"
              :disabled="isUnmeasuredSlide(slide)"
              @click="selectSlide(index)"
            >
              <span>S{{ slide.slideNumber }}</span>
              {{ slide.coreContent || slide.title }}
            </button>
          </nav>
          <article v-if="selectedSlide" data-slide-feedback>
            <h3 :title="selectedSlide.coreContent || selectedSlide.title">슬라이드 {{ selectedSlide.slideNumber }}. {{ selectedSlide.coreContent || selectedSlide.title }}</h3>

            <p v-if="selectedSlideUnmeasured" class="pr-unmeasured-note" data-slide-unmeasured>
              이 슬라이드는 발화가 없어(빠르게 넘김) 분석할 수 없어요.
            </p>

            <div v-else class="pr-said-block">
              <span class="pr-block-label">내가 말한 내용</span>
              <p class="pr-said-text">{{ selectedSlideTranscript }}</p>
            </div>

            <div class="pr-feedback-block" :class="{ 'is-empty': !selectedSlide.feedback?.content }">
              <span class="pr-block-label">AI 피드백</span>
              <p v-if="selectedSlide.feedback?.content">{{ selectedSlide.feedback.content }}</p>
              <p v-else class="pr-data-empty">등록된 AI 피드백이 없습니다.</p>
            </div>
          </article>
        </div>
      </section>

      <section
        v-if="hasQuestionAnswerSection"
        data-qna-feedback
        class="pr-feedback"
        aria-labelledby="presentation-qna-feedback-title"
      >
        <header>
          <h2 id="presentation-qna-feedback-title">질의응답 피드백</h2>
          <p>질문별 답변과 AI 피드백을 확인하세요.</p>
        </header>
        <div v-if="answeredQuestionAnswers.length" class="pr-qna-list">
          <article v-for="item in answeredQuestionAnswers" :key="item.questionId">
            <h3 :title="item.question"><span class="pr-qna-code">{{ item.code }}</span>{{ item.question }}</h3>
            <div class="pr-said-block">
              <span class="pr-block-label">내가 말한 내용</span>
              <p class="pr-said-text pr-qna-answer">{{ item.userAnswer }}</p>
            </div>
            <div v-if="item.feedback?.content" class="pr-feedback-block">
              <span class="pr-block-label">AI 피드백</span>
              <p class="pr-qna-feedback">{{ item.feedback.content }}</p>
            </div>
          </article>
        </div>
        <p v-else class="pr-data-empty">
          답변한 질문이 없어 질의응답 점수와 피드백이 생성되지 않았습니다.
        </p>
      </section>
    </template>
  </main>
</template>
