<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 1 },
})

const emit = defineEmits(['update:modelValue'])

const MIN_ZOOM = 1
const MAX_ZOOM = 2
const STEP = 0.1

const zoomLabel = computed(() => `${Number(props.modelValue).toFixed(1)}×`)

const updateZoom = (value) => {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value) || MIN_ZOOM))
  emit('update:modelValue', Math.round(next * 10) / 10)
}
</script>

<template>
  <div class="camera-zoom-control" aria-label="카메라 화면 확대 조절">
    <button type="button" :disabled="modelValue >= MAX_ZOOM" aria-label="카메라 화면 확대" @click="updateZoom(modelValue + STEP)">+</button>
    <div class="camera-zoom-slider">
      <input
        :value="modelValue"
        type="range"
        :min="MIN_ZOOM"
        :max="MAX_ZOOM"
        :step="STEP"
        aria-label="카메라 화면 확대 배율"
        @input="updateZoom($event.target.value)"
      />
    </div>
    <button type="button" :disabled="modelValue <= MIN_ZOOM" aria-label="카메라 화면 축소" @click="updateZoom(modelValue - STEP)">−</button>
    <output class="camera-zoom-value" aria-live="polite">{{ zoomLabel }}</output>
  </div>
</template>
