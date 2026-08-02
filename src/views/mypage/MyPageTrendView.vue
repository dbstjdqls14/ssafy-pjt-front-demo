<script setup>
import { computed, onMounted, ref } from 'vue'

import { userApi } from '../../api/index.js'
import { withMock } from '../../api/withMock.js'

// 학습 추이 기본 데이터. 백엔드(GET /users/me/stats)가 준비되기 전에는 목업으로 이 값을
// 그대로 돌려주어 화면이 오프라인에서도 동일하게 보이게 한다. 실제 응답이 오면 상단 요약·
// 핵심 지표·역량 데이터가 그 값으로 대체된다.
const DEFAULT_STATS = {
  summary: { score: 84, delta: 6 },
  metrics: [
    { label: '속도', value: '128', unit: '단어/분' },
    { label: '집중도', value: '81%', unit: '' },
    { label: '성장률', value: '+8%', unit: '' },
    { label: '연속 기록', value: '4', unit: '일' },
  ],
  capabilities: {
    presentation: [
      ['슬라이드 전달력', '75 → 90'],
      ['속도 일관성', '80 → 92'],
      ['핵심 메시지 전달', '72 → 88'],
      ['청중 질문 대응', '68 → 81'],
    ],
    interview: [
      ['답변 구조화', '74 → 89'],
      ['직무 적합성', '80 → 90'],
      ['자신감', '69 → 85'],
      ['꼬리질문 대응', '65 → 79'],
    ],
  },
}

const stats = ref(DEFAULT_STATS)

const summary = computed(() => stats.value.summary ?? DEFAULT_STATS.summary)
const metrics = computed(() => stats.value.metrics ?? DEFAULT_STATS.metrics)

const capabilityTab = ref('presentation')
const capabilities = computed(() => {
  const source = stats.value.capabilities ?? DEFAULT_STATS.capabilities
  return source[capabilityTab.value] ?? []
})

onMounted(async () => {
  const result = await withMock(
    () => userApi.getStats({ type: 'overall', period: 'recent' }),
    () => DEFAULT_STATS,
  )
  const value = result?.data ?? result
  if (value) stats.value = { ...DEFAULT_STATS, ...value }
})
</script>

<template>
  <section class="mypage-panel">
    <section class="learning-growth-card" aria-label="최근 다섯 번의 연습 성장 추이">
          <div class="learning-growth-main">
            <div class="learning-growth-score">
              <small>종합 점수</small>
              <strong>{{ summary.score }}</strong>
              <p>지난 연습보다 <b>+{{ summary.delta }}</b></p>
            </div>

            <div class="learning-growth-chart">
              <div class="learning-growth-plot">
                <!-- 앵커 x를 라벨(10·30·50·70·90%)에 맞춰 균등 배치. 포인트는 SVG 스트레치로
                     타원이 되지 않도록 HTML 원(.learning-growth-dot)으로 그려 라벨과 정렬한다. -->
                <svg viewBox="0 0 720 290" role="img" aria-label="최근 다섯 번의 연습 점수 추이" preserveAspectRatio="none">
                  <path class="learning-growth-fill" d="M72 221 C120 210 168 172 216 168 C264 164 312 165 360 165 C408 165 456 108 504 99 C552 90 600 64 648 56 L648 275 L72 275 Z" />
                  <path class="learning-growth-line" d="M72 221 C120 210 168 172 216 168 C264 164 312 165 360 165 C408 165 456 108 504 99 C552 90 600 64 648 56" />
                </svg>
                <span class="learning-growth-dot" style="left: 10%; top: 76.2%"></span>
                <span class="learning-growth-dot" style="left: 30%; top: 57.9%"></span>
                <span class="learning-growth-dot" style="left: 50%; top: 56.9%"></span>
                <span class="learning-growth-dot" style="left: 70%; top: 34.1%"></span>
                <span class="learning-growth-dot is-current" style="left: 90%; top: 19.3%"></span>
              </div>
              <div class="learning-growth-labels" aria-hidden="true">
                <span>72<small>1회</small></span>
                <span>78<small>2회</small></span>
                <span>77<small>3회</small></span>
                <span>82<small>4회</small></span>
                <span>84<small>현재</small></span>
              </div>
            </div>
          </div>

          <dl class="learning-growth-metrics">
            <div v-for="metric in metrics" :key="metric.label">
              <dt>{{ metric.label }}</dt>
              <dd>{{ metric.value }} <small v-if="metric.unit">{{ metric.unit }}</small></dd>
            </div>
          </dl>
        </section>

        <div class="trend-section">
          <h3>핵심 역량 변화</h3>
          <div class="trend-tabs">
            <button type="button" :class="{ active: capabilityTab === 'presentation' }" @click="capabilityTab = 'presentation'">발표</button>
            <button type="button" :class="{ active: capabilityTab === 'interview' }" @click="capabilityTab = 'interview'">면접</button>
          </div>

          <div class="capability-grid">
            <div v-for="([label, value]) in capabilities" :key="label" class="capability-item">
              <small>{{ label }}</small><strong>{{ value }}</strong>
            </div>
          </div>
        </div>

        <div class="trend-section">
          <h3>말하기 습관 변화</h3>

          <div class="habit-table-wrap">
            <table class="habit-progress-table">
              <thead>
                <tr><th>지표</th><th>1회</th><th>2회</th><th>3회</th><th>현재</th></tr>
              </thead>
              <tbody>
                <tr><th>추임새 사용</th><td>18회</td><td>15회</td><td>11회</td><td>8회</td></tr>
                <tr><th>평균 말하기 속도</th><td>190</td><td>180</td><td>168</td><td>162 WPM</td></tr>
                <tr><th>긴 침묵</th><td>7회</td><td>5회</td><td>4회</td><td>2회</td></tr>
                <tr><th>시선 이탈</th><td>15회</td><td>13회</td><td>8회</td><td>6회</td></tr>
              </tbody>
            </table>
          </div>

          <div class="habit-conclusion">
            <strong class="habit-conclusion-title">
              <span class="habit-ai-badge">AI 피드백</span>
              가장 크게 개선된 영역
            </strong>
            <p>추임새 사용과 긴 침묵이 절반 이상 줄었고, 시선 이탈도 꾸준히 감소하고 있어요.</p>
          </div>
        </div>

        <div class="trend-section">
          <h3>반복되는 문제</h3>
          <ul class="numbered-list">
            <li><span><b>01</b>답변의 결론이 늦게 나옴</span><span>최근 5회 중 4회</span></li>
            <li><span><b>02</b>발표 후반부 발화 속도 증가</span><span>최근 5회 중 3회</span></li>
            <li><span><b>03</b>구체적인 수치 및 근거 부족</span><span>최근 5회 중 3회</span></li>
          </ul>
        </div>

        <div class="trend-section">
          <h3>최근 연습 비교</h3>
          <table class="compare-table">
            <thead><tr><th>연습</th><th>유형</th><th>종합 점수</th><th>편차</th></tr></thead>
            <tbody>
              <tr><td>07.16 · 서비스 소개 발표</td><td>발표</td><td>92점</td><td class="delta">+8점</td></tr>
              <tr><td>07.09 · 1분 자기소개</td><td>면접</td><td>86점</td><td class="delta">+5점</td></tr>
              <tr><td>07.02 · 프로젝트 회고</td><td>발표</td><td>84점</td><td class="delta">+3점</td></tr>
            </tbody>
          </table>
        </div>

        <div class="trend-section">
          <h3>다음 연습 추천 목표</h3>
          <ul class="numbered-list">
            <li><span><b>01</b>첫 30초 안에 결론부터 말하기</span></li>
            <li><span><b>02</b>핵심 주장 뒤에 수치나 사례 1개 붙이기</span></li>
            <li><span><b>03</b>발표 후반부에도 150~165 WPM 유지하기</span></li>
          </ul>
        </div>
  </section>
</template>
