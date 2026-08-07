<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 1 },
})

const emit = defineEmits(['update:modelValue'])

const MIN_ZOOM = 0.6
const MAX_ZOOM = 2.4
const STEP = 0.2

const valueLabel = computed(() => `${Math.round(props.modelValue * 100)}%`)
const updateZoom = (value) => {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value) || MIN_ZOOM))
  emit('update:modelValue', Math.round(next * 10) / 10)
}
</script>

<template>
  <div class="presentation-slide-zoom" aria-label="슬라이드 화면 확대 조절">
    <button
      type="button"
      :disabled="modelValue >= MAX_ZOOM"
      aria-label="슬라이드 확대"
      @click="updateZoom(modelValue + STEP)"
    >+</button>
    <input
      :value="modelValue"
      type="range"
      :min="MIN_ZOOM"
      :max="MAX_ZOOM"
      :step="STEP"
      aria-label="슬라이드 확대 비율"
      @input="updateZoom($event.target.value)"
    />
    <button
      type="button"
      :disabled="modelValue <= MIN_ZOOM"
      aria-label="슬라이드 축소"
      @click="updateZoom(modelValue - STEP)"
    >−</button>
    <button type="button" class="presentation-slide-zoom-value" aria-label="슬라이드 확대 초기화" @click="updateZoom(1)">
      {{ valueLabel }}
    </button>
  </div>
</template>
