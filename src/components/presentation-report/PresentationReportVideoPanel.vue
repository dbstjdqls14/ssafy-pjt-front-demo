<script setup>
import { computed, watch } from 'vue'

import { presentationClock } from '../../composables/usePresentationReportVideo.js'
import { isUnmeasuredPresentationSlide } from '../../utils/presentationReportSlides.js'

// 영상·자막 영역은 면접 리포트와 같은 마크업(.iv-video-row / .iv-caption-*)을 쓴다.
// 재생 버튼 크기, 진행 바 두께, 자막 글자 크기까지 면접과 한 CSS에서 따라오게 하고,
// 발표에만 있는 슬라이드 썸네일 줄만 추가한다.
const props = defineProps({
  slides: { type: Array, required: true },
  selectedIndex: { type: Number, required: true },
  videoUrl: { type: String, default: '' },
  mediaKey: { type: String, default: '' },
  controller: { type: Object, required: true },
})

const selectedSlide = computed(() => props.slides[props.selectedIndex] ?? null)
const setVideoRef = (element) => props.controller.setVideoElement(element)

watch(() => props.mediaKey, () => {
  props.controller.reset?.()
})

const absoluteSec = computed(() => Number(props.controller.absoluteSec?.value) || 0)
const totalDurationSec = computed(() => Number(props.controller.totalDurationSec?.value) || 0)
const progressPct = computed(() => Number(props.controller.progressPct?.value) || 0)

// 전체 녹화의 발화를 시간순으로 이어 붙인다(슬라이드 경계와 무관하게 자막이
// 자연스럽게 흐르도록 — 면접의 allSentences와 같은 방식).
const allSentences = computed(() => props.slides
  .flatMap((slide) => (slide.transcriptSegments ?? []).map((segment) => ({
    atSec: Number(segment.absoluteStartSec ?? segment.startSec) || 0,
    text: String(segment.text ?? '').trim(),
    isSeekable: Boolean(
      segment.isTimestamped
      && segment.absoluteStartSec != null
      && Number.isFinite(Number(segment.absoluteStartSec)),
    ),
  })))
  .filter((sentence) => sentence.text)
  .sort((left, right) => left.atSec - right.atSec)
  .filter((sentence, index, list) => (
    index === 0 || sentence.atSec !== list[index - 1].atSec || sentence.text !== list[index - 1].text
  )))

const activeSentenceIndex = computed(() => {
  let bestIndex = -1
  allSentences.value.forEach((sentence, index) => {
    if (sentence.atSec <= absoluteSec.value) bestIndex = index
  })
  return bestIndex
})
const activeSentenceItem = computed(() => (
  activeSentenceIndex.value >= 0 ? allSentences.value[activeSentenceIndex.value] : null
))
const activeSentence = computed(() => activeSentenceItem.value?.text ?? '')

const seekSentence = (sentence) => {
  if (!sentence?.isSeekable) return
  props.controller.seekAbsolute(sentence.atSec)
}

// 빠르게 넘겨 발화가 없는 슬라이드를 보고 있을 때, 앞 슬라이드 문장이 그대로 얼어
// 붙어 보이면 오해하게 된다 → 왜 자막이 없는지 그 자리에 밝힌다.
const isUnmeasuredSlide = computed(() => isUnmeasuredPresentationSlide(selectedSlide.value))

const selectSlide = (index) => {
  if (isUnmeasuredPresentationSlide(props.slides[index])) return
  props.controller.selectSlide(index)
}

const previousSelectableIndex = computed(() => {
  for (let index = props.selectedIndex - 1; index >= 0; index -= 1) {
    if (!isUnmeasuredPresentationSlide(props.slides[index])) return index
  }
  return -1
})

const nextSelectableIndex = computed(() => {
  for (let index = props.selectedIndex + 1; index < props.slides.length; index += 1) {
    if (!isUnmeasuredPresentationSlide(props.slides[index])) return index
  }
  return -1
})

// 현재 문장을 카드 중앙에 고정하려면 위·아래 줄 수가 항상 같아야 한다 →
// 문장이 모자라면 빈 줄로 자리만 채운다(면접과 동일).
const CAPTION_WINDOW = 3
const priorSentences = computed(() => {
  const index = activeSentenceIndex.value
  const real = allSentences.value.slice(Math.max(0, index - CAPTION_WINDOW), Math.max(0, index))
  return [...Array.from({ length: CAPTION_WINDOW - real.length }, () => null), ...real]
})
const nextSentences = computed(() => {
  const real = allSentences.value.slice(activeSentenceIndex.value + 1, activeSentenceIndex.value + 1 + CAPTION_WINDOW)
  return [...real, ...Array.from({ length: CAPTION_WINDOW - real.length }, () => null)]
})
</script>

<template>
  <section class="iv-video-row pr-media" aria-label="발표 영상과 슬라이드 발화">
    <div class="iv-video-col">
      <video
        v-if="videoUrl"
        :key="mediaKey"
        :ref="setVideoRef"
        class="iv-answer-video"
        :src="videoUrl"
        playsinline
        preload="metadata"
        @timeupdate="controller.onTimeUpdate"
        @play="controller.onPlay?.()"
        @pause="controller.onPause?.()"
      />
      <div v-else class="iv-answer-video-empty">녹화 영상이 없어요</div>

      <div class="pr-thumbnails" aria-label="슬라이드 선택">
        <button
          v-for="(slide, index) in slides"
          :key="slide.slideId"
          type="button"
          :data-slide-thumbnail="index"
          :class="{
            'is-active': index === selectedIndex,
            'is-unmeasured': isUnmeasuredPresentationSlide(slide),
          }"
          :disabled="isUnmeasuredPresentationSlide(slide)"
          @click="selectSlide(index)"
        >
          <img v-if="slide.imageUrl" :src="slide.imageUrl" :alt="`슬라이드 ${slide.slideNumber}`">
          <span v-else>슬라이드 {{ slide.slideNumber }}</span>
        </button>
      </div>

      <div class="iv-video-controls-bar">
        <button
          type="button"
          class="iv-video-play-btn"
          :aria-label="controller.isPlaying.value ? '일시정지' : '재생'"
          @click="controller.togglePlay"
        >{{ controller.isPlaying.value ? '⏸' : '▶' }}</button>
        <button
          type="button"
          class="iv-video-scrub"
          aria-label="재생 위치 이동"
          @pointerdown="controller.onScrubPointerDown"
          @pointermove="controller.onScrubPointerMove"
          @pointerup="controller.onScrubPointerUp"
          @pointercancel="controller.onScrubPointerCancel"
          @lostpointercapture="controller.onScrubPointerCancel"
        >
          <span class="iv-video-scrub-fill" :style="{ width: `${progressPct}%` }"></span>
        </button>
        <span class="iv-video-time">
          {{ presentationClock(absoluteSec) }} / {{ presentationClock(totalDurationSec) }}
        </span>
      </div>
    </div>

    <div v-if="selectedSlide" class="iv-label-col pr-slide-column">
      <div class="iv-video-question-row">
        <button
          type="button"
          class="iv-rq-nav"
          :disabled="previousSelectableIndex < 0"
          aria-label="이전 슬라이드"
          @click="selectSlide(previousSelectableIndex)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
        </button>
        <h3 class="iv-video-question" :title="selectedSlide.coreContent || selectedSlide.title">
          슬라이드 {{ selectedSlide.slideNumber }}. {{ selectedSlide.coreContent || selectedSlide.title }}
        </h3>
        <button
          type="button"
          class="iv-rq-nav"
          :disabled="nextSelectableIndex < 0"
          aria-label="다음 슬라이드"
          @click="selectSlide(nextSelectableIndex)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
        </button>
      </div>

      <div class="iv-caption-stack pr-transcript">
        <div class="iv-caption-prior-wrap">
          <component
            v-for="(sentence, index) in priorSentences"
            :key="`prior-${index}`"
            :is="sentence?.isSeekable ? 'button' : 'p'"
            :type="sentence?.isSeekable ? 'button' : undefined"
            class="iv-caption-line iv-caption-prior"
            :class="{ 'is-empty': !sentence, 'iv-caption-seek': sentence?.isSeekable }"
            :data-caption-seek="sentence?.isSeekable ? '' : undefined"
            @click="seekSentence(sentence)"
          >{{ sentence?.text }}</component>
        </div>
        <component
          :is="activeSentenceItem?.isSeekable && !isUnmeasuredSlide ? 'button' : 'p'"
          :type="activeSentenceItem?.isSeekable && !isUnmeasuredSlide ? 'button' : undefined"
          class="iv-caption-line iv-caption-current"
          :class="{
            'is-unmeasured': isUnmeasuredSlide,
            'iv-caption-seek': activeSentenceItem?.isSeekable && !isUnmeasuredSlide,
          }"
          data-slide-caption
          :data-caption-seek="activeSentenceItem?.isSeekable && !isUnmeasuredSlide ? '' : undefined"
          @click="seekSentence(activeSentenceItem)"
        >
          <template v-if="isUnmeasuredSlide">이 슬라이드는 발화가 없어(빠르게 넘김) 자막이 없어요.</template>
          <template v-else>{{ activeSentence || '위 표시나 영상을 재생해보세요.' }}</template>
        </component>
        <div class="iv-caption-next-wrap">
          <component
            v-for="(sentence, index) in nextSentences"
            :key="`next-${index}`"
            :is="sentence?.isSeekable ? 'button' : 'p'"
            :type="sentence?.isSeekable ? 'button' : undefined"
            class="iv-caption-line iv-caption-next"
            :class="{ 'is-empty': !sentence, 'iv-caption-seek': sentence?.isSeekable }"
            :data-caption-seek="sentence?.isSeekable ? '' : undefined"
            @click="seekSentence(sentence)"
          >{{ sentence?.text }}</component>
        </div>
      </div>
    </div>
  </section>
</template>
