<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

import { usePresentationStore } from '../../stores/presentationStore.js'

const router = useRouter()
const presentation = usePresentationStore()
const artifacts = computed(() => presentation.recordingArtifacts)
const submitting = ref(false)
const error = ref('')

const objectUrls = []
const objectUrl = (blob) => {
  if (!blob) return ''
  const url = URL.createObjectURL(blob)
  objectUrls.push(url)
  return url
}

const webmUrl = objectUrl(artifacts.value?.webm)
const wavUrl = objectUrl(artifacts.value?.wav)
const textJson = computed(() => JSON.stringify(artifacts.value?.text ?? [], null, 2))
const detectsJson = computed(() => JSON.stringify(artifacts.value?.detects ?? [], null, 2))
const durationLabel = computed(() => {
  const seconds = Math.round((artifacts.value?.durationMs ?? 0) / 1_000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const formatBytes = (size = 0) => (
  size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${(size / 1024).toFixed(1)} KB`
)

const download = (blob, fileName) => {
  if (!blob) return
  const url = objectUrl(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
}
const downloadJson = (json, fileName) => {
  download(new Blob([json], { type: 'application/json' }), fileName)
}

const complete = async () => {
  if (!artifacts.value || submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    await presentation.completeSession({ durationMs: artifacts.value.durationMs })
    if (presentation.qnaEnabled) {
      await presentation.generateAudienceQuestions()
      await router.push('/presentation/qna')
    } else {
      await router.push('/presentation/report')
    }
  } catch (caught) {
    error.value = caught?.message || '발표 완료 요청에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<template>
  <main class="page-shell artifact-review-shell">
    <header class="artifact-review-head">
      <div>
        <p>발표 종료 데이터</p>
        <h1>최종 전송 데이터 확인</h1>
        <span>아래 네 자료는 브라우저에서 실제 생성된 결과입니다. 현재 Spring에는 이 네 자료를 받는 API가 없어 완료 요청에는 발표 시간만 전송됩니다.</span>
      </div>
      <strong>{{ durationLabel }}</strong>
    </header>

    <section v-if="artifacts" class="artifact-grid">
      <article data-artifact-card class="artifact-card">
        <header><h2>WebM</h2><span>{{ formatBytes(artifacts.webm?.size) }}</span></header>
        <video v-if="webmUrl" :src="webmUrl" controls playsinline></video>
        <button type="button" @click="download(artifacts.webm, 'presentation.webm')">WebM 다운로드</button>
      </article>

      <article data-artifact-card class="artifact-card">
        <header><h2>WAV</h2><span>{{ formatBytes(artifacts.wav?.size) }}</span></header>
        <audio v-if="wavUrl" :src="wavUrl" controls></audio>
        <p>16 kHz · mono · 16-bit PCM</p>
        <button type="button" @click="download(artifacts.wav, 'presentation.wav')">WAV 다운로드</button>
      </article>

      <article data-artifact-card class="artifact-card artifact-json-card">
        <header><h2>text[]</h2><span>{{ artifacts.text.length }}개 방문</span></header>
        <pre data-json="text">{{ textJson }}</pre>
        <button type="button" @click="downloadJson(textJson, 'presentation-text.json')">text JSON 다운로드</button>
      </article>

      <article data-artifact-card class="artifact-card artifact-json-card">
        <header><h2>detects[]</h2><span>{{ artifacts.detects.length }}개 구간</span></header>
        <pre data-json="detects">{{ detectsJson }}</pre>
        <button type="button" @click="downloadJson(detectsJson, 'presentation-detects.json')">detects JSON 다운로드</button>
      </article>
    </section>

    <section v-else class="artifact-empty">
      <h2>확인할 녹화 데이터가 없습니다.</h2>
      <RouterLink to="/presentation/record">발표 녹화로 돌아가기</RouterLink>
    </section>

    <footer v-if="artifacts" class="artifact-actions">
      <p v-if="error" role="alert">{{ error }}</p>
      <button
        type="button"
        class="artifact-complete-button"
        :disabled="submitting"
        @click="complete"
      >{{ submitting ? '완료 처리 중…' : '확인 완료 · 발표 종료' }}</button>
    </footer>
  </main>
</template>

<style scoped>
.artifact-review-shell {
  max-width: 1440px;
  margin: 0 auto;
  padding: 48px 32px 80px;
}
.artifact-review-head {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}
.artifact-review-head p { margin: 0 0 6px; color: #6366f1; font-weight: 800; }
.artifact-review-head h1 { margin: 0; color: #1f2440; font-size: 32px; }
.artifact-review-head span { display: block; max-width: 820px; margin-top: 10px; color: #64748b; line-height: 1.6; }
.artifact-review-head > strong { color: #4338ca; font-size: 30px; font-variant-numeric: tabular-nums; }
.artifact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.artifact-card {
  min-width: 0;
  padding: 22px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 14px 34px rgba(48, 42, 120, .06);
}
.artifact-card header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.artifact-card h2 { margin: 0; color: #1f2440; font-size: 20px; }
.artifact-card header span, .artifact-card p { color: #64748b; font-size: 13px; font-weight: 700; }
.artifact-card video { width: 100%; max-height: 280px; border-radius: 12px; background: #111827; }
.artifact-card audio { width: 100%; margin: 28px 0 10px; }
.artifact-card button, .artifact-complete-button {
  margin-top: 14px;
  padding: 11px 16px;
  border: 0;
  border-radius: 10px;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 800;
  cursor: pointer;
}
.artifact-json-card pre {
  height: 280px;
  overflow: auto;
  margin: 0;
  padding: 14px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.artifact-actions { display: grid; justify-items: end; margin-top: 24px; }
.artifact-actions p { color: #dc2626; }
.artifact-complete-button { padding: 14px 24px; background: #4f46e5; color: #fff; font-size: 15px; }
.artifact-complete-button:disabled { opacity: .55; cursor: wait; }
.artifact-empty { padding: 80px 24px; text-align: center; }
@media (max-width: 860px) {
  .artifact-review-shell { padding: 32px 18px 60px; }
  .artifact-review-head { display: grid; }
  .artifact-grid { grid-template-columns: 1fr; }
}
</style>
