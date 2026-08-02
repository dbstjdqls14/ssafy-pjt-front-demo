<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { mockStatus } from '../../utils/mockStatus.js'

const route = useRoute()

// 페이지가 바뀌면 이전 페이지가 남긴 표시를 지운다 — 안 그러면 새 페이지에서도
// 이전 화면의 "이건 목업이에요" 딱지가 그대로 남아있을 수 있다.
watch(() => route.fullPath, () => {
  Object.keys(mockStatus).forEach((key) => { delete mockStatus[key] })
})

const activeLabels = computed(() => Object.keys(mockStatus).filter((key) => mockStatus[key]))
</script>

<template>
  <div v-if="activeLabels.length" class="mock-data-banner" role="status">
    <span class="mock-data-banner-icon" aria-hidden="true">⚠️</span>
    <span class="mock-data-banner-text">
      지금 화면의 <strong>{{ activeLabels.join(', ') }}</strong>은(는) 아직 실제 서버 데이터가 아니라 임시(테스트용) 데이터예요.
    </span>
  </div>
</template>

<style scoped>
.mock-data-banner {
  position: fixed;
  left: 50%;
  bottom: 18px;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(92vw, 560px);
  padding: 10px 16px;
  border-radius: 999px;
  background: #fff4e5;
  border: 1px solid #f0b429;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .14);
  color: #7a4a00;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  transform: translateX(-50%);
}

.mock-data-banner-icon {
  flex: 0 0 auto;
  font-size: 16px;
}

.mock-data-banner-text strong {
  font-weight: 800;
}
</style>
