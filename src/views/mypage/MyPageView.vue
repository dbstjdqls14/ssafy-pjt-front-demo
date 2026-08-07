<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '../../stores/authStore.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const user = computed(() => auth.user ?? { nickname: '', email: '' })
const initial = computed(() => user.value.nickname.slice(0, 1))

const isEditing = ref(false)
const nickname = ref('')
const nicknameError = ref('')

const enterEdit = () => {
  nickname.value = user.value.nickname
  nicknameError.value = ''
  isEditing.value = true
}
const cancelEdit = () => {
  isEditing.value = false
}
const save = async () => {
  nicknameError.value = ''
  if (!nickname.value.trim()) {
    nicknameError.value = '닉네임을 입력해주세요.'
    return
  }
  try {
    await auth.updateProfile({ nickname: nickname.value.trim() })
    isEditing.value = false
  } catch (caught) {
    nicknameError.value = caught?.payload?.message || '프로필 수정에 실패했어요. 잠시 후 다시 시도해주세요.'
  }
}
const withdraw = () => {
  if (window.confirm('정말 회원 탈퇴하시겠어요? 모든 연습 기록이 삭제됩니다. (데모: 실제로 삭제되지 않습니다)')) {
    auth.logout()
    router.push('/')
  }
}

onMounted(() => {
  if (route.query.edit === '1') enterEdit()
})
</script>

<template>
  <section class="mypage-panel">
    <div v-if="!isEditing">
          <header class="mypage-content-head">
            <div>
              <h2>내 정보</h2>
              <p>프로필과 연동된 계정을 한눈에 확인할 수 있어요.</p>
            </div>
          </header>

          <div class="mypage-profile-surface">
            <div class="avatar">{{ initial }}</div>
            <div class="name-block">
              <strong>{{ user.nickname }}</strong>
              <span>{{ user.email }}</span>
              <div class="google-account-row">
                <i aria-hidden="true"></i>
                <div>
                  <strong>Google 계정 연동됨</strong>
                  <small>{{ user.email }}</small>
                </div>
              </div>
            </div>
            <button type="button" class="btn-primary mypage-primary-action" @click="enterEdit">프로필 수정하기</button>
          </div>

          <h3 class="mypage-section-title">계정 정보</h3>
          <div class="account-info-grid">
            <div class="account-info-box">
              <small>가입 이메일</small>
              <strong>{{ user.email }}</strong>
            </div>
            <div class="account-info-box">
              <small>가입일</small>
              <strong>2026.07.01</strong>
            </div>
          </div>
        </div>

        <div v-else>
          <header class="mypage-content-head">
            <div>
              <h2>내 정보 수정</h2>
              <p>프로필 이미지와 기본 계정 정보를 수정할 수 있어요.</p>
            </div>
          </header>

          <form class="mypage-edit-card mypage-edit-surface" novalidate @submit.prevent="save">
            <div class="mypage-edit-avatar-col">
              <div class="avatar-upload">
                <span>{{ initial }}</span>
                <div class="overlay">이미지 변경</div>
              </div>
              <p class="avatar-upload-caption">{{ user.email }}</p>
              <div class="google-badge-block">
                <i></i>
                <div>
                  <strong>Google 계정 연동됨</strong>
                  <span>{{ user.email }}</span>
                </div>
              </div>
            </div>

            <div class="mypage-edit-form">
              <div class="form-field" :class="{ 'field-invalid': nicknameError }">
                <label for="nickname">닉네임</label>
                <input id="nickname" v-model="nickname" type="text" @input="nicknameError = ''" />
                <small v-if="nicknameError" class="field-error">{{ nicknameError }}</small>
              </div>
              <div class="form-field">
                <label for="email">이메일</label>
                <input id="email" :value="user.email" type="email" disabled />
              </div>

              <RouterLink to="/mypage/security" class="btn-ghost-sm password-change-btn">비밀번호 변경</RouterLink>

              <div class="profile-actions mypage-edit-actions">
                <button type="button" class="danger-link" @click="withdraw">회원 탈퇴</button>
                <div class="mypage-form-actions">
                  <button type="button" class="btn-secondary" @click="cancelEdit">취소</button>
                  <button type="submit" class="btn-primary">완료</button>
                </div>
              </div>
            </div>
          </form>
        </div>
  </section>
</template>
