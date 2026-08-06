<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { INPUT_LIMITS } from '../../constants/inputLimits.js'

// Searchable single-select combobox for the interview setup (회사명·직군·지원 직무).
// Looks like the native form select but opens a filterable option list.
const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '선택' },
  searchPlaceholder: { type: String, default: '검색어를 입력하세요' },
  disabled: { type: Boolean, default: false },
  // 옵션이 몇 개뿐인 항목(경력 구분 등)은 검색칸 없이 같은 모양만 쓴다.
  searchable: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const query = ref('')
const rootEl = ref(null)
const searchEl = ref(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((option) => option.toLowerCase().includes(q))
})

// v-model(vModelText)은 한글 조합이 끝날 때까지 값을 갱신하지 않아서, 'ㅇ→여→연'을
// 치는 동안 후보 목록이 멈춘 것처럼 보인다. 조합 중 input 이벤트까지 그대로 반영한다.
const onQueryInput = (event) => {
  query.value = event.target.value
}

const toggle = async () => {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    query.value = ''
    if (!props.searchable) return
    await nextTick()
    searchEl.value?.focus()
  }
}
const close = () => {
  open.value = false
}
const select = (option) => {
  emit('update:modelValue', option)
  close()
}

const onDocPointer = (event) => {
  if (rootEl.value && !rootEl.value.contains(event.target)) close()
}
onMounted(() => document.addEventListener('mousedown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocPointer))
</script>

<template>
  <div ref="rootEl" class="iv-select" :class="{ 'is-open': open }">
    <button
      type="button"
      class="iv-select-trigger"
      :class="{ 'is-placeholder': !modelValue }"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span>{{ modelValue || placeholder }}</span>
      <svg class="iv-select-caret" viewBox="0 0 12 8" aria-hidden="true">
        <path d="m1 1.5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div v-if="open" class="iv-select-pop" :class="{ 'is-plain': !searchable }">
      <input
        v-if="searchable"
        ref="searchEl"
        :value="query"
        type="text"
        class="iv-select-search"
        :maxlength="INPUT_LIMITS.SEARCH"
        :placeholder="searchPlaceholder"
        @input="onQueryInput"
        @keydown.esc.prevent="close"
      />
      <ul class="iv-select-list" role="listbox">
        <li
          v-for="option in filtered"
          :key="option"
          class="iv-select-option"
          :class="{ active: option === modelValue }"
          role="option"
          :aria-selected="option === modelValue"
          @click="select(option)"
        >
          {{ option }}
        </li>
        <li v-if="!filtered.length" class="iv-select-empty">검색 결과가 없어요</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.iv-select {
  position: relative;
  width: 100%;
}

.iv-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid #dbe1ec;
  border-radius: 9px;
  background: #fff;
  color: #172346;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.iv-select-trigger.is-placeholder {
  color: #8b94a7;
}

.iv-select-trigger:disabled {
  background: #f4f6fa;
  color: #a6adc0;
  cursor: not-allowed;
}

.iv-select.is-open .iv-select-trigger,
.iv-select-trigger:focus-visible {
  border-color: #4e6fc2;
  outline: 3px solid rgba(78, 111, 194, 0.14);
}

.iv-select-caret {
  flex: 0 0 auto;
  width: 12px;
  height: 8px;
  color: #8b94a7;
  transition: transform 0.18s ease;
}

.iv-select.is-open .iv-select-caret {
  transform: rotate(180deg);
}

.iv-select-pop {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  padding: 8px;
  border: 1px solid #dbe1ec;
  border-radius: 11px;
  background: #fff;
  box-shadow: 0 12px 30px rgba(23, 35, 70, 0.14);
}

.iv-select-search {
  width: 100%;
  height: 36px;
  padding: 0 11px;
  border: 1px solid #dbe1ec;
  border-radius: 8px;
  background: #f7f8fb;
  color: #172346;
  font: inherit;
  font-size: 13px;
}

.iv-select-search:focus {
  border-color: #4e6fc2;
  outline: 2px solid rgba(78, 111, 194, 0.14);
  background: #fff;
}

.iv-select-list {
  max-height: 190px;
  margin: 8px 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.iv-select-option {
  padding: 9px 10px;
  border-radius: 8px;
  color: #3a4359;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.iv-select-option:hover {
  background: #f4f7ff;
}

.iv-select-option.active {
  background: #eef2ff;
  color: #405fbd;
  font-weight: 750;
}

.iv-select-pop.is-plain .iv-select-list {
  margin-top: 0;
}

.iv-select-empty {
  padding: 12px 10px;
  color: #8b94a7;
  font-size: 12.5px;
  text-align: center;
}
</style>
