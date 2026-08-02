<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { usePresentationStore } from '../../stores/presentationStore.js'

const router = useRouter()
const presentation = usePresentationStore()

const checks = ref({ screen: false, audio: false, ppt: false, ready: false })
const canOpenReview = ref(false)
const readyState = ref('checklist') // 'checklist' | 'review' | 'ready'
const slideError = ref('')

const reviewIndex = ref(0)
const slides = computed(() => presentation.slides)
const reviewSlide = computed(() => slides.value[reviewIndex.value] ?? { title: '', keyPoints: '' })
const reviewKeyContent = computed(() => reviewSlide.value.keyPoints?.trim() || '작성한 핵심 내용이 없습니다.')

let active = true
const timers = []
const wait = (ms) => new Promise((resolve) => timers.push(setTimeout(resolve, ms)))

// 순환 없이: 처음/끝에서 멈춘다(버튼은 끝에서 비활성화).
const prevSlide = () => {
  if (reviewIndex.value > 0) reviewIndex.value -= 1
}
const nextSlide = () => {
  if (reviewIndex.value < slides.value.length - 1) reviewIndex.value += 1
}

const openReview = () => { if (canOpenReview.value) readyState.value = 'review' }
const editNotes = () => router.push('/presentation/slides')
const confirmSlides = async () => {
  readyState.value = 'checklist'
  await wait(420)
  if (!active) return
  checks.value.ready = true
  await wait(520)
  if (!active) return
  readyState.value = 'ready'
}
const start = () => { if (readyState.value === 'ready') router.push('/presentation/record') }

onMounted(async () => {
  await presentation.ensureSlidesLoaded()
  for (const key of ['screen', 'audio']) {
    await wait(760)
    if (!active) return
    checks.value[key] = true
  }
  checks.value.ppt = presentation.hasRenderableSlides
  canOpenReview.value = checks.value.ppt
  if (!checks.value.ppt) slideError.value = '변환된 슬라이드 이미지를 불러오지 못했습니다. 발표 자료를 다시 업로드해 주세요.'
})

onBeforeUnmount(() => {
  active = false
  timers.forEach(clearTimeout)
})
</script>

<template>
  <main class="page-shell presentation-flow-shell" data-flow-shell>
    <div class="wizard-shell">
      <div class="workflow-stage">
        <div class="workflow-stage-content ready-flow-content" data-flow-content>
          <section v-show="readyState !== 'review'" class="ready-confirm-card" aria-label="설정 확인 항목">
            <ol class="ready-check-list" aria-live="polite">
              <li class="ready-item" :class="{ done: checks.screen }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.screen ? '✓' : '' }}</i>
                <div><strong>화면 연결 확인</strong><span class="status">연결 정상</span></div>
              </li>
              <li class="ready-item" :class="{ done: checks.audio }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.audio ? '✓' : '' }}</i>
                <div><strong>음성 오디오 확인</strong><span class="status">오디오 정상</span></div>
              </li>
              <li class="ready-item" :class="{ done: checks.ppt }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.ppt ? '✓' : '' }}</i>
                <div><strong>발표 PPT 업로드</strong><span class="status">{{ checks.ppt ? '업로드 완료' : '확인 필요' }}</span></div>
              </li>
              <li class="ready-item" :class="{ done: checks.ready }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.ready ? '✓' : '' }}</i>
                <div class="ready-item-main">
                  <div><strong>발표 준비</strong><span class="status">작성 완료</span></div>
                  <button type="button" class="ready-review-link" :disabled="!canOpenReview" @click="openReview">
                    슬라이드 확인하러가기
                  </button>
                </div>
              </li>
            </ol>

            <p v-if="slideError" class="ready-slide-error" role="alert">{{ slideError }}</p>

            <button
              type="button"
              class="btn-primary ready-start-button"
              :class="{ 'is-ready': readyState === 'ready' }"
              :disabled="readyState !== 'ready'"
              @click="start"
            >발표 시작</button>
          </section>

          <section
            v-show="readyState === 'review'"
            class="ready-slide-review is-visible"
            aria-label="슬라이드 핵심 내용 확인"
          >
            <header class="slide-key-head ready-review-head">
              <div>
                <h1>슬라이드별 핵심 내용</h1>
                <p>발표 전 슬라이드별 핵심 내용을 다시 확인해 보세요.</p>
              </div>
              <div class="slide-page-control" aria-label="슬라이드 이동">
                <button type="button" aria-label="이전 슬라이드" :disabled="reviewIndex === 0" @click="prevSlide">‹</button>
                <span class="slide-counter">{{ reviewIndex + 1 }} 슬라이드</span>
                <button type="button" aria-label="다음 슬라이드" :disabled="reviewIndex === slides.length - 1" @click="nextSlide">›</button>
              </div>
            </header>
            <div class="ready-slide-panel">
              <div class="ready-slide-preview">
                <img
                  v-if="reviewSlide.previewUrl"
                  class="ready-slide-image"
                  :src="reviewSlide.previewUrl"
                  :alt="`${reviewIndex + 1}번 슬라이드 미리보기`"
                />
                <div v-else class="slide-nav-body ready-slide-unavailable">
                  <span class="eyebrow">SPEECH COACH</span>
                  <h3>슬라이드 이미지를 불러올 수 없어요.</h3>
                  <p>발표 자료를 다시 업로드해 주세요.</p>
                </div>
              </div>
              <div class="ready-key-content">
                <span class="ready-key-label">핵심 내용</span>
                <p class="ready-note-plain">{{ reviewKeyContent }}</p>
              </div>
            </div>
            <div class="ready-review-actions">
              <button type="button" class="ready-edit-button" @click="editNotes">다시 작성하러 가기</button>
              <button type="button" class="btn-primary ready-confirm-button" @click="confirmSlides">확인 완료</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>
