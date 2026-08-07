<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getAccessToken } from '../../api/authToken.js'
import { INPUT_LIMITS } from '../../constants/inputLimits.js'
import { vGraphemeMax } from '../../directives/graphemeMax.js'
import { usePracticeStore } from '../../stores/practiceStore.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import { useInterviewStore } from '../../stores/interviewStore.js'
import {
  TEXT_INPUT_POLICIES,
  countGraphemes,
  textPolicyValidationMessage,
} from '../../utils/textInputPolicy.js'

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
const descriptionError = ref('')
const newFolderNameInput = ref(null)
const newFolderDescriptionInput = ref(null)
const deleteTarget = ref(null)
const deleteError = ref('')
const isDeletingFolder = ref(false)
const FOLDER_NAME_MAX_LENGTH = INPUT_LIMITS.FOLDER_NAME
const FOLDER_DESC_MAX_LENGTH = INPUT_LIMITS.PRACTICE_DESCRIPTION

const folderNamePolicyMessage = (value) => textPolicyValidationMessage(value, {
  policy: TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT,
  maxLength: FOLDER_NAME_MAX_LENGTH,
})
const folderDescriptionPolicyMessage = (value) => textPolicyValidationMessage(value, {
  policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
  maxLength: FOLDER_DESC_MAX_LENGTH,
})
const onFolderNameInput = (event) => {
  nameError.value = folderNamePolicyMessage(event.target.value)
}
const onFolderDescriptionInput = (event) => {
  descriptionError.value = folderDescriptionPolicyMessage(event.target.value)
}

const typeFolders = computed(() => practice.folders.filter((folder) => folder.type === practiceType.value))
const filteredFolders = computed(() => typeFolders.value)
const selected = computed(() => typeFolders.value.find((folder) => String(folder.id) === String(selectedId.value)) ?? typeFolders.value[0] ?? null)
const selectFolder = (folder) => {
  selectedId.value = folder.id
}

const requestFolderDelete = () => {
  if (!selected.value || isDeletingFolder.value) return
  deleteError.value = ''
  deleteTarget.value = selected.value
}

const closeFolderDelete = () => {
  if (isDeletingFolder.value) return
  deleteTarget.value = null
  deleteError.value = ''
}

const confirmFolderDelete = async () => {
  if (!deleteTarget.value || isDeletingFolder.value) return
  const targetId = deleteTarget.value.id
  isDeletingFolder.value = true
  deleteError.value = ''
  try {
    await practice.removeFolder(targetId)
    deleteTarget.value = null
    if (String(selectedId.value) === String(targetId)) {
      selectedId.value = typeFolders.value[0]?.id ?? null
    }
  } catch (error) {
    deleteError.value = error?.message || '폴더를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    isDeletingFolder.value = false
  }
}

const displayScore = (score) => {
  if (score == null || score === '') return '-'
  const number = Number(score)
  return Number.isFinite(number) ? `${Math.round(number)}점` : '-'
}

const displayHistoryDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const today = new Date()
  if (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  ) return '오늘'
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

const displayAttempt = (index) => {
  const count = Number(practice.recentPracticeCount)
  if (!Number.isFinite(count) || count <= index) return ''
  return `${Math.trunc(count) - index}회`
}

// 자료 선택(새 업로드 / 폴더의 기존 자료 재사용)은 다음 단계인 발표 설정 화면의
// '자료 업로드' 영역에서 한다. 여기서는 폴더만 고른다.
const goToSetup = async () => {
  // 새 연습 시작이므로 이전 플로우 초안(연습 이름·자료 등)을 비워 빈 상태로 진입.
  if (practiceType.value === 'presentation') presentation.reset()
  else interview.reset()
  await router.push(`/${practiceType.value}/setup`)
}

const onNext = async () => {
  if (mode.value === 'new') {
    nameError.value = ''
    descriptionError.value = ''
    if (!newFolderName.value.trim()) {
      nameError.value = '폴더명을 입력해주세요.'
      newFolderNameInput.value?.focus()
      return
    }
    const nextNameError = folderNamePolicyMessage(newFolderName.value)
    if (nextNameError) {
      nameError.value = nextNameError
      newFolderNameInput.value?.focus()
      return
    }
    const nextDescriptionError = folderDescriptionPolicyMessage(newFolderDesc.value)
    if (nextDescriptionError) {
      descriptionError.value = nextDescriptionError
      newFolderDescriptionInput.value?.focus()
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
// 글자를 칠 때마다 바로 조회한다(디바운스 없음). 응답 순서가 뒤바뀌어도
// practiceStore의 requestSequence가 오래된 응답을 버리므로 목록이 튀지 않는다.
watch([practiceType, search], () => {
  fetchFolders()
})

// v-model(vModelText)은 한글 조합이 끝날 때까지 값을 갱신하지 않아서, 'ㅇ→여→연'을
// 치는 동안 검색이 멈춘 것처럼 보인다. 조합 중 input 이벤트까지 그대로 반영한다.
const onSearchInput = (event) => {
  search.value = event.target.value
}
watch(typeFolders, (folders) => {
  if (!folders.some((folder) => String(folder.id) === String(selectedId.value))) selectedId.value = folders[0]?.id ?? null
})
watch(selected, (folder) => {
  if (!folder?.id) {
    practice.clearRecentPractices()
    return
  }
  practice.loadRecentPractices(folder.id).catch(() => {})
}, { immediate: true })
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
                    <input id="folderSearch" :value="search" type="text" class="folder-search" :maxlength="INPUT_LIMITS.SEARCH" placeholder="폴더명 또는 주제 검색" @input="onSearchInput" />
                  </label>
                  <ul class="folder-list">
                    <li
                      v-for="folder in filteredFolders"
                      :key="folder.id"
                      class="folder-row"
                      :class="{ selected: selected?.id === folder.id }"
                      tabindex="0"
                      role="button"
                      :aria-pressed="selected?.id === folder.id"
                      @click="selectFolder(folder)"
                      @keydown.enter.prevent="selectFolder(folder)"
                      @keydown.space.prevent="selectFolder(folder)"
                    >
                      <div>
                        <strong class="folder-row-title" :title="folder.name">{{ folder.name }}</strong>
                        <small class="folder-row-meta">
                          {{ folder.type === 'presentation' ? '발표' : '면접' }}
                          <template v-if="folder.reportCount !== null"> · {{ folder.reportCount }}회 연습</template>
                          <template v-else> · 리포트 수 확인 불가</template>
                        </small>
                      </div>
                      <span class="folder-row-score" :class="{ 'is-empty': folder.latestScore == null }">
                        {{ folder.latestScore == null ? '기록 없음' : `최근 ${displayScore(folder.latestScore)}` }}
                      </span>
                    </li>
                    <li v-if="practice.loading" class="folder-list-state">폴더를 불러오는 중입니다.</li>
                    <li v-else-if="practice.error" class="folder-list-state is-error" role="alert">{{ practice.error }}</li>
                    <li v-else-if="!filteredFolders.length" class="folder-list-state">검색 조건에 맞는 폴더가 없어요.</li>
                  </ul>
                </section>

                <aside class="folder-preview" aria-live="polite">
                  <div v-if="selected" class="folder-preview-summary">
                    <div class="folder-preview-title-row" :data-folder-id="selected.id">
                      <strong :title="selected.name">{{ selected.name }}</strong>
                        <button
                          type="button"
                          class="folder-preview-delete"
                          data-testid="folder-delete-trigger"
                          aria-label="선택한 폴더 삭제"
                          :disabled="isDeletingFolder"
                          @click.stop="requestFolderDelete"
                        ><span aria-hidden="true"></span></button>
                    </div>
                    <dl class="folder-preview-score">
                      <dt>최고 점수</dt>
                      <dd>{{ selected.best == null ? '기록 없음' : displayScore(selected.best) }}</dd>
                    </dl>
                    <section class="folder-preview-history" aria-label="최근 완료 연습">
                      <h2>최근 연습</h2>
                      <p v-if="practice.recentPracticesLoading" class="folder-preview-history-empty">최근 연습 기록을 불러오는 중입니다.</p>
                      <p v-else-if="practice.recentPracticesError" class="folder-preview-history-empty is-error">최근 연습 기록을 불러오지 못했습니다.</p>
                      <ol v-else-if="practice.recentPractices.length">
                        <li
                          v-for="(item, index) in practice.recentPractices"
                          :key="item.id ?? `${selected.id}-${index}`"
                          class="folder-preview-history-item"
                        >
                          <span>{{ displayAttempt(index) }}</span>
                          <time :datetime="item.createdAt || undefined">{{ displayHistoryDate(item.createdAt) }}</time>
                          <strong>{{ displayScore(item.score) }}</strong>
                        </li>
                      </ol>
                      <p v-else class="folder-preview-history-empty is-empty">기록 없음</p>
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
                  <div class="limited-field is-underline-field">
                     <input ref="newFolderNameInput" id="newFolderName" v-model="newFolderName" v-grapheme-max="FOLDER_NAME_MAX_LENGTH" type="text" placeholder="예) 졸업작품 발표" @input="onFolderNameInput" />
                     <small class="field-counter" data-testid="folder-name-counter" aria-live="polite">{{ countGraphemes(newFolderName) }}/{{ FOLDER_NAME_MAX_LENGTH }}</small>
                  </div>
                  <small v-if="nameError" class="field-error" role="alert">{{ nameError }}</small>
                  <small v-else-if="practice.error" class="field-error" role="alert">{{ practice.error }}</small>
                </div>
                <div class="form-field" :class="{ 'field-invalid': descriptionError }">
                  <label for="newFolderDesc">설명 (선택)</label>
                  <div class="folder-desc-field limited-field">
                    <textarea ref="newFolderDescriptionInput" id="newFolderDesc" v-model="newFolderDesc" v-grapheme-max="FOLDER_DESC_MAX_LENGTH" rows="4" placeholder="이 주제에 대한 간단한 메모를 남겨보세요." @input="onFolderDescriptionInput"></textarea>
                    <span class="folder-desc-counter" data-testid="folder-description-counter" aria-live="polite">{{ countGraphemes(newFolderDesc) }}/{{ FOLDER_DESC_MAX_LENGTH }}</span>
                  </div>
                  <small v-if="descriptionError" class="field-error" role="alert">{{ descriptionError }}</small>
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

  <div
    v-if="deleteTarget"
    class="folder-delete-backdrop"
    data-testid="folder-delete-dialog"
    role="presentation"
    @click.self="closeFolderDelete"
  >
    <section class="folder-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="folderDeleteTitle">
      <h2 id="folderDeleteTitle">폴더를 삭제하시겠습니까?</h2>
      <p>관련 리포트도 모두 삭제됩니다.</p>
      <p class="folder-delete-name" :title="deleteTarget.name">{{ deleteTarget.name }}</p>
      <p v-if="deleteError" class="folder-delete-error" role="alert">{{ deleteError }}</p>
      <div class="folder-delete-actions">
        <button
          type="button"
          class="folder-delete-cancel"
          data-testid="cancel-folder-delete"
          :disabled="isDeletingFolder"
          @click="closeFolderDelete"
        >취소</button>
        <button
          type="button"
          class="folder-delete-confirm"
          data-testid="confirm-folder-delete"
          :disabled="isDeletingFolder"
          @click="confirmFolderDelete"
        >{{ isDeletingFolder ? '삭제 중…' : '삭제' }}</button>
      </div>
    </section>
  </div>
</template>
