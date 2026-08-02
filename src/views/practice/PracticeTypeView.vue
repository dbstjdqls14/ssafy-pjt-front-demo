<script setup>
import { useRouter } from 'vue-router'

import { usePracticeStore } from '../../stores/practiceStore.js'
import presentationIllustration from '../../assets/images/practice-presentation-illustration.png'
import interviewIllustration from '../../assets/images/practice-interview-illustration.png'

const router = useRouter()
const practice = usePracticeStore()

const choose = (type) => {
  practice.setMode(type)
  router.push(`/practice/folders?type=${type}`)
}
</script>

<template>
  <main class="page-shell practice-flow-shell practice-type-shell">
    <div class="type-grid">
      <a
        class="type-card type-card-presentation"
        href="/practice/folders?type=presentation"
        aria-label="발표 연습 시작하기"
        @click.prevent="choose('presentation')"
      >
        <span class="type-tag">PRESENTATION</span>
        <h3>발표 연습</h3>
        <p>PPT를 보며 발표하고 슬라이드별 내용 및 전달력 및 비언어 표현을 분석합니다.</p>
        <ul class="type-check-list type-check-list-flat">
          <li>✓ 발표 시간 측정</li>
          <li>✓ 청중 질문</li>
        </ul>
        <div class="type-illustration" aria-hidden="true">
          <img class="type-illustration-image" :src="presentationIllustration" alt="" />
        </div>
      </a>

      <a
        class="type-card type-card-interview"
        href="/practice/folders?type=interview"
        aria-label="면접 연습 시작하기"
        @click.prevent="choose('interview')"
      >
        <span class="type-tag">INTERVIEW</span>
        <h3>면접 연습</h3>
        <p>지원 자료와 직무 정보를 기반으로 질문을 만들고 답변 영상을 분석합니다.</p>
        <ul class="type-check-list type-check-list-flat">
          <li>✓ 답변별 녹화</li>
          <li>✓ 면접 리포트</li>
        </ul>
        <div class="type-illustration" aria-hidden="true">
          <img class="type-illustration-image" :src="interviewIllustration" alt="" />
        </div>
      </a>
    </div>
  </main>
</template>
