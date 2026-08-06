<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// Mypage sidebar navigation (replaces the legacy renderMypageNav). The security
// page highlights "내 정보", matching the legacy behaviour.
const items = [
  { key: 'info', label: '내 정보', to: '/mypage' },
  { key: 'documents', label: '자소서/포트폴리오', to: '/mypage/documents' },
  { key: 'trend', label: '내 학습 추이', to: '/mypage/trend' },
]

const route = useRoute()
const activeKey = computed(() => {
  if (route.path.startsWith('/mypage/documents')) return 'documents'
  if (route.path.startsWith('/mypage/trend')) return 'trend'
  return 'info'
})
</script>

<template>
  <nav class="mypage-nav">
    <RouterLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      :class="{ active: activeKey === item.key }"
      :aria-current="activeKey === item.key ? 'page' : undefined"
    >{{ item.label }}</RouterLink>
  </nav>
</template>
