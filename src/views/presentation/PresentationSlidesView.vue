<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import PresentationSlideZoomControl from '../../components/presentation/PresentationSlideZoomControl.vue'
import { INPUT_LIMITS } from '../../constants/inputLimits.js'
import { vGraphemeMax } from '../../directives/graphemeMax.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import {
  TEXT_INPUT_POLICIES,
  countGraphemes,
  textPolicyValidationMessage,
} from '../../utils/textInputPolicy.js'

const router = useRouter()
const presentation = usePresentationStore()
const SLIDE_NOTE_MAX_LENGTH = INPUT_LIMITS.SLIDE_NOTE

const slides = computed(() => presentation.slides)
const total = computed(() => presentation.slideCount)
const index = computed(() => presentation.currentSlideIndex)
const currentSlide = computed(() => slides.value[index.value] ?? { id: 0, title: '', keyPoints: '' })
const slideNumberLabel = computed(() => String(index.value + 1).padStart(2, '0'))

// Task 4: while the uploaded deck is still being converted on the server, show a
// skeleton in the viewer. Once slides carry a previewUrl (backend-rendered
// page image) the <img> renders the real slide; otherwise a title card stands in.
const isProcessing = computed(() => presentation.uploadStatus === 'processing')
const headNote = computed(() =>
  isProcessing.value ? '업로드한 자료를 슬라이드로 변환하고 있어요…' : '업로드한 자료를 보며 발표할 내용을 정리하세요.',
)
const isSaving = ref(false)
const saveError = ref('')
const noteInput = ref(null)
const canContinue = computed(() => presentation.hasRenderableSlides && total.value > 0)
// 확대·축소는 자료 종류(PDF/세로 슬라이드)와 무관하게 항상 쓸 수 있다. 가로
// 슬라이드도 글자가 작아 확대해서 확인해야 하는 경우가 많다.
const slideZoom = ref(1)
const resetSlideZoom = () => { slideZoom.value = 1 }

watch(() => currentSlide.value.previewUrl, resetSlideZoom)

const keyPoints = computed({
  get: () => currentSlide.value.keyPoints ?? '',
  set: (value) => presentation.setSlideKeyPoints(currentSlide.value.id, value),
})
const slideNotePolicyMessage = (value) => textPolicyValidationMessage(value, {
  policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
  maxLength: SLIDE_NOTE_MAX_LENGTH,
})
const currentNoteError = computed(() => slideNotePolicyMessage(keyPoints.value))

// 순환 없이: 처음/끝에서 멈춘다(버튼은 끝에서 비활성화).
const prevSlide = () => {
  if (index.value > 0) presentation.setCurrentSlideIndex(index.value - 1)
}
const nextSlide = () => {
  if (index.value < total.value - 1) presentation.setCurrentSlideIndex(index.value + 1)
}
const goNext = async () => {
  if (isSaving.value) return
  if (!canContinue.value) {
    saveError.value = '변환된 슬라이드 이미지를 불러온 뒤 다음 단계로 이동할 수 있어요.'
    return
  }
  const invalidSlideIndex = slides.value.findIndex((slide) => slideNotePolicyMessage(slide.keyPoints))
  if (invalidSlideIndex >= 0) {
    presentation.setCurrentSlideIndex(invalidSlideIndex)
    saveError.value = ''
    await nextTick()
    noteInput.value?.focus()
    return
  }
  isSaving.value = true
  saveError.value = ''
  try {
    await presentation.saveSlideNotes()
    // 장치 확인을 이미 통과한 연습이면(설정 확인에서 '다시 작성하러 가기'로 온 경우)
    // 같은 확인을 반복하지 않고 설정 확인으로 바로 돌아간다.
    await router.push(presentation.preflightDone ? '/presentation/ready' : '/presentation/check')
  } catch (error) {
    saveError.value = error?.message || '핵심 내용을 저장하지 못했습니다. 다시 시도해 주세요.'
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  await presentation.ensureSlidesLoaded()
  if (!canContinue.value) saveError.value = '변환된 슬라이드 이미지를 불러오지 못했습니다. 발표 자료를 다시 업로드해 주세요.'
})
</script>

<template>
  <main class="page-shell presentation-flow-shell" data-flow-shell>
    <div class="wizard-shell">
      <div class="workflow-stage">
        <div class="workflow-stage-content" data-flow-content>
          <section class="slide-key-content" aria-labelledby="slideKeyTitle">
            <header class="slide-key-head">
              <div>
                <h1 id="slideKeyTitle">슬라이드별 핵심 내용</h1>
                <p>{{ headNote }}</p>
              </div>
              <div class="slide-page-control" aria-label="슬라이드 이동">
                <button type="button" aria-label="이전 슬라이드" :disabled="index === 0" @click="prevSlide">‹</button>
                <span class="slide-counter">{{ index + 1 }} 슬라이드</span>
                <button type="button" aria-label="다음 슬라이드" :disabled="index === total - 1" @click="nextSlide">›</button>
              </div>
            </header>

            <!-- 확대 컨트롤을 슬라이드 프레임 바깥(오른쪽)에 두기 위한 래퍼 -->
            <div class="slide-preview-shell">
              <div class="slide-preview-frame" aria-live="polite">
                <div v-if="isProcessing" class="slide-preview-skeleton" aria-hidden="true">
                  <span class="slide-skeleton-line is-w40"></span>
                  <span class="slide-skeleton-block"></span>
                  <span class="slide-skeleton-line is-w70"></span>
                  <span class="slide-skeleton-line is-w55"></span>
                </div>
                <div
                  v-else-if="currentSlide.previewUrl"
                  class="slide-preview-viewport is-zoomable"
                  :style="{ '--slide-zoom': slideZoom }"
                >
                  <img
                    class="slide-preview-image"
                    :src="currentSlide.previewUrl"
                    :alt="`${index + 1}번 슬라이드 미리보기`"
                  />
                </div>
                <div v-else class="slide-preview-fallback slide-preview-unavailable" role="status">
                  <small>SLIDE <span>{{ slideNumberLabel }}</span></small>
                  <h2>슬라이드 이미지를 불러올 수 없어요.</h2>
                  <p>PPTX 변환 API 응답의 <code>previewUrl</code>을 확인한 뒤 다시 업로드해 주세요.</p>
                </div>
              </div>
              <PresentationSlideZoomControl
                v-if="currentSlide.previewUrl"
                v-model="slideZoom"
              />
            </div>

            <div class="slide-note-panel">
              <div class="slide-note-heading">
                <label for="noteInput">핵심 내용 (선택)</label>
              </div>
              <textarea
                ref="noteInput"
                id="noteInput"
                v-model="keyPoints"
                v-grapheme-max="SLIDE_NOTE_MAX_LENGTH"
                placeholder="이 슬라이드에서 반드시 전달할 메시지와 추가 설명을 정리해보세요."
              ></textarea>
              <span class="char-counter" data-testid="slide-note-counter" aria-live="polite">{{ countGraphemes(keyPoints) }}/{{ SLIDE_NOTE_MAX_LENGTH }}</span>
              <small v-if="currentNoteError" class="field-error" data-testid="slide-note-error" role="alert">{{ currentNoteError }}</small>
              <small v-else-if="saveError" class="field-error" role="alert">{{ saveError }}</small>
            </div>
          </section>
        </div>

        <div class="workflow-footer-actions">
          <RouterLink
            class="workflow-side-button workflow-side-prev"
            to="/presentation/setup"
            aria-label="연습 설정으로 돌아가기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </RouterLink>
          <button
            type="button"
            class="workflow-side-button workflow-side-next"
            aria-label="장치 확인으로 이동"
            :disabled="isSaving || !canContinue"
            :aria-busy="isSaving"
            @click="goNext"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
