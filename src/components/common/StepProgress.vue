<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Wizard progress rail, shared by the presentation and interview flows. Mirrors
// the legacy `.presentation-progress` pill bar (styled by presentation-flow.css;
// the interview variant adds `is-interview-progress`), driven by the route.
const FLOWS = {
  presentation: [
    { path: '/presentation/setup', label: '1 자료·설정' },
    { path: '/presentation/slides', label: '2 핵심 내용' },
    { path: '/presentation/check', label: '3 장치 확인' },
    { path: '/presentation/ready', label: '4 설정 확인' },
  ],
  interview: [
    { path: '/interview/setup', label: '1 면접 정보' },
    { path: '/interview/style', label: '2 면접관 선택' },
    { path: '/interview/questions', label: '3 질문 생성' },
    { path: '/interview/check', label: '4 장치 확인' },
    { path: '/interview/ready', label: '5 설정 확인' },
  ],
}

const route = useRoute()
const router = useRouter()
const flow = computed(() => route.meta.flow)
const steps = computed(() => FLOWS[flow.value] ?? [])
const activeIndex = computed(() => steps.value.findIndex((step) => step.path === route.path))
const visible = computed(() => activeIndex.value !== -1)
const label = computed(() => (flow.value === 'interview' ? '면접 준비 진행 단계' : '발표 준비 진행 단계'))
const goStep = (step) => { if (step.path !== route.path) router.push(step.path) }
</script>

<template>
  <div v-if="visible" class="aivo-persistent-flow-progress">
    <div
      class="step-pillbar presentation-progress"
      :class="{ 'is-interview-progress': flow === 'interview' }"
      :aria-label="label"
    >
      <button
        v-for="(step, index) in steps"
        :key="step.path"
        type="button"
        class="step-pill"
        :class="{ active: index === activeIndex }"
        :aria-current="index === activeIndex ? 'step' : undefined"
        @click="goStep(step)"
      ><i></i>{{ step.label }}</button>
    </div>
  </div>
</template>
