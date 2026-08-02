<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getAccessToken } from '../../api/authToken.js'
import { useDebouncedCallback } from '../../composables/useDebouncedCallback.js'
import { usePracticeStore } from '../../stores/practiceStore.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import { useInterviewStore } from '../../stores/interviewStore.js'

const route = useRoute()
const router = useRouter()
const practice = usePracticeStore()
const presentation = usePresentationStore()
const interview = useInterviewStore()

const practiceType = computed(() => (route.query.type === 'interview' ? 'interview' : 'presentation'))

const mode = ref('existing') // 'existing' | 'new'
const search = ref('')
const selectedId = ref(practice.folderId)
const newFolderName = ref('')
const newFolderDesc = ref('')
const nameError = ref('')
const DESCRIPTION_MAX_LENGTH = 50

// maxlength는 한글 IME 조합 중이거나 저장값이 다시 주입될 때 잠시 넘을 수
// 있으므로 모델 자체도 잘라 카운터와 실제 전송값을 함께 제한한다.
watch(newFolderDesc, (value) => {
  const limited = String(value ?? '').slice(0, DESCRIPTION_MAX_LENGTH)
  if (limited !== value) newFolderDesc.value = limited
})

const typeFolders = computed(() => practice.folders.filter((folder) => folder.type === practiceType.value))
const filteredFolders = computed(() => typeFolders.value)
const selected = computed(() => typeFolders.value.find((folder) => folder.id === selectedId.value) ?? typeFolders.value[0] ?? null)
const selectFolder = (folder) => {
  selectedId.value = folder.id
}

const goToSetup = async () => {
  // 새 연습 시작이므로 이전 플로우 초안(연습 이름·자료 등)을 비워 빈 상태로 진입.
  // 자료(기존 재사용/새 업로드) 선택은 다음 화면(연습 설정)의 자료 업로드
  // 영역에서 이뤄진다.
  if (practiceType.value === 'presentation') presentation.reset()
  else interview.reset()
  await router.push(`/${practiceType.value}/setup`)
}

const onNext = async () => {
  if (mode.value === 'new') {
    nameError.value = ''
    if (!newFolderName.value.trim()) {
      nameError.value = '폴더명을 입력해주세요.'
      return
    }
    // 폴더 생성은 로그인(Bearer 토큰)이 필요한 API다. 백엔드가 비로그인 요청에
    // 500을 돌려줘서 원인을 알기 어려우니, 요청 전에 미리 안내한다.
    if (!getAccessToken()) {
      nameError.value = '로그인 후 폴더를 만들 수 있어요.'
      return
    }
    try {
      await practice.createFolder({ name: newFolderName.value.trim(), type: practiceType.value, description: newFolderDesc.value.trim() })
      await goToSetup()
    } catch {
      // Store error is rendered next to the form.
    }
    return
  }
  if (!selected.value) return
  practice.setMode(practiceType.value)
  practice.setFolder({ id: selected.value.id, name: selected.value.name })
  await goToSetup()
}

const fetchFolders = async () => {
  try {
    return await practice.loadFolders({ type: practiceType.value, keyword: search.value.trim() })
  } catch {
    // Store가 실제 API 오류를 화면에 표시한다. 목 폴더로 조용히 대체하지 않는다.
    return []
  }
}
const { schedule: scheduleFetchFolders } = useDebouncedCallback(fetchFolders, 250)
watch([practiceType, search], () => {
  scheduleFetchFolders()
})
watch(typeFolders, (folders) => {
  if (!folders.some((folder) => folder.id === selectedId.value)) selectedId.value = folders[0]?.id ?? null
})
onMounted(() => {
  practice.setMode(practiceType.value)
  fetchFolders()
})
</script>

<template>
  <div class="practice-ambient" aria-hidden="true"><i></i><i></i><i></i></div>

  <main class="page-shell practice-flow-shell folder-flow-shell" :class="{ 'is-new-mode': mode === 'new' }" data-flow-shell>
    <div class="wizard-shell folder-wizard-shell">
      <div class="folder-flow-intro" data-flow-intro>
        <header class="page-head practice-flow-head">
          <h1>연습 폴더 선택 및 생성</h1>
        </header>

        <div class="auth-tabs folder-mode-tabs" role="tablist" aria-label="폴더 선택 방식">
          <button type="button" :class="{ active: mode === 'existing' }" role="tab" :aria-selected="mode === 'existing'" @click="mode = 'existing'">기존 폴더 선택</button>
          <button type="button" :class="{ active: mode === 'new' }" role="tab" :aria-selected="mode === 'new'" @click="mode = 'new'">새 폴더 만들기</button>
        </div>
      </div>

      <div class="workflow-stage">
        <div class="workflow-stage-content folder-stage-content" data-flow-content>
          <div class="folder-layout">
            <div v-show="mode === 'existing'" class="folder-panel" role="tabpanel">
              <div class="folder-workspace">
                <section class="folder-list-pane" aria-label="연습 폴더 목록">
                  <label class="folder-search-wrap" for="folderSearch">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
                    <input id="folderSearch" v-model="search" type="text" class="folder-search" placeholder="폴더명 또는 주제 검색" />
                  </label>
                  <ul class="folder-list">
                    <li
                      v-for="folder in filteredFolders"
                      :key="folder.name"
                      class="folder-row"
                      :class="{ selected: selected?.name === folder.name }"
                      tabindex="0"
                      role="button"
                      :aria-pressed="selected?.name === folder.name"
                      @click="selectFolder(folder)"
                      @keydown.enter.prevent="selectFolder(folder)"
                      @keydown.space.prevent="selectFolder(folder)"
                    >
                      <div><strong>{{ folder.name }}</strong><small>{{ folder.meta }}</small></div>
                      <span class="folder-badge">{{ folder.badge }}</span>
                    </li>
                    <li v-if="practice.loading" class="folder-list-state">폴더를 불러오는 중입니다.</li>
                    <li v-else-if="practice.error" class="folder-list-state is-error" role="alert">{{ practice.error }}</li>
                    <li v-else-if="!filteredFolders.length" class="folder-list-state">검색 조건에 맞는 폴더가 없어요.</li>
                  </ul>
                </section>

                <aside class="folder-preview" aria-live="polite">
                  <div v-if="selected" class="folder-preview-summary">
                    <div class="folder-preview-title-row">
                      <strong :title="selected.name">{{ selected.name }}</strong>
                    </div>
                    <dl class="folder-preview-score">
                      <dt>최고 점수</dt>
                      <dd>{{ selected?.best }}점</dd>
                    </dl>
                    <section class="folder-preview-history" aria-labelledby="previewHistoryTitle">
                      <h2 id="previewHistoryTitle">최근 연습</h2>
                      <ol>
                        <li v-for="a in (selected?.attempts ?? []).slice(0, 3)" :key="a.attempt">
                          <span>{{ a.attempt }}회</span><time>{{ a.date }}</time><strong>{{ a.score }}점</strong>
                        </li>
                      </ol>
                    </section>
                  </div>
                  <div v-else class="folder-preview-empty">
                    <span class="folder-preview-empty-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M3.5 7.5h6l1.8 2h9.2v8.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2Z"/><path d="M3.5 7.5V5.7a2.2 2.2 0 0 1 2.2-2.2h3.1l1.8 2h7.7a2.2 2.2 0 0 1 2.2 2.2v1.8"/></svg>
                    </span>
                    <strong>새 폴더를 만드세요</strong>
                    <p>{{ practiceType === 'presentation' ? '발표 자료와 연습 기록을 한곳에 모을 수 있어요.' : '면접 설정과 연습 기록을 한곳에 모을 수 있어요.' }}</p>
                    <button type="button" @click="mode = 'new'">새 폴더 만들기</button>
                  </div>
                </aside>
              </div>
            </div>

            <div v-show="mode === 'new'" class="folder-panel folder-new-panel" role="tabpanel">
              <div class="folder-new-form">
                <div class="form-field" :class="{ 'field-invalid': nameError }">
                  <label for="newFolderName">폴더명 및 주제</label>
                  <input id="newFolderName" v-model="newFolderName" type="text" placeholder="예) 졸업작품 발표" @input="nameError = ''" />
                  <small v-if="nameError" class="field-error">{{ nameError }}</small>
                  <small v-else-if="practice.error" class="field-error" role="alert">{{ practice.error }}</small>
                </div>
                <div class="form-field">
                  <label for="newFolderDesc">설명 (선택)</label>
                  <div class="folder-desc-field">
                    <textarea id="newFolderDesc" v-model="newFolderDesc" rows="4" :maxlength="DESCRIPTION_MAX_LENGTH" placeholder="이 주제에 대한 간단한 메모를 남겨보세요."></textarea>
                    <span class="folder-desc-counter">{{ newFolderDesc.length }}/{{ DESCRIPTION_MAX_LENGTH }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="workflow-footer-actions">
          <RouterLink class="workflow-side-button workflow-side-prev" to="/practice" aria-label="연습 유형 선택으로 돌아가기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </RouterLink>
          <button type="button" class="workflow-side-button workflow-side-next" :disabled="practice.saving || (mode === 'existing' && !selected)" aria-label="선택한 폴더로 다음 단계 이동" @click="onNext">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
