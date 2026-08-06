<script setup>
import AppHeader from '../components/common/AppHeader.vue'
import AppFooter from '../components/common/AppFooter.vue'
import StepProgress from '../components/common/StepProgress.vue'
</script>

<template>
  <AppHeader />
  <StepProgress />
  <slot />
  <AppFooter />
</template>
