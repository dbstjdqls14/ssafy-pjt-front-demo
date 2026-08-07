<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { INPUT_LIMITS } from '../../constants/inputLimits.js'
import { vGraphemeMax } from '../../directives/graphemeMax.js'
import { useAuthStore } from '../../stores/authStore.js'
import { countGraphemes } from '../../utils/textInputPolicy.js'
import { usernameValidationMessage } from '../../utils/validators.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const user = computed(() => auth.user ?? { nickname: '', email: '' })
const initial = computed(() => user.value.nickname.slice(0, 1))
const accountCreatedAt = computed(() => {
  if (!user.value.createdAt) return '정보 없음'
  const date = new Date(user.value.createdAt)
  if (Number.isNaN(date.getTime())) return '정보 없음'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
})

const isEditing = ref(false)
const nickname = ref('')
const nicknameError = ref('')
const profileImageInput = ref(null)
const profileImage = ref(null)
const profileImagePreviewUrl = ref('')
const profileImageError = ref('')
const removeProfileImage = ref(false)
const NICKNAME_MAX_LENGTH = INPUT_LIMITS.USERNAME

const onNicknameInput = (event) => {
  nicknameError.value = usernameValidationMessage(event.target.value)
}

const ALLOWED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024
const editingProfileImageUrl = computed(() => {
  if (profileImagePreviewUrl.value) return profileImagePreviewUrl.value
  if (removeProfileImage.value) return ''
  return user.value.profileImageUrl ?? ''
})
const editingProfileImageKey = computed(() => {
  if (profileImagePreviewUrl.value) return `preview::${profileImagePreviewUrl.value}`
  if (removeProfileImage.value) return 'removed'
  return auth.profileImageIdentity
})

const releaseProfileImagePreview = () => {
  if (!profileImagePreviewUrl.value) return
  URL.revokeObjectURL(profileImagePreviewUrl.value)
  profileImagePreviewUrl.value = ''
}

const resetProfileImageDraft = () => {
  releaseProfileImagePreview()
  profileImage.value = null
  profileImageError.value = ''
  removeProfileImage.value = false
  if (profileImageInput.value) profileImageInput.value.value = ''
}

const enterEdit = () => {
  nickname.value = user.value.nickname
  nicknameError.value = ''
  resetProfileImageDraft()
  isEditing.value = true
}
const cancelEdit = () => {
  resetProfileImageDraft()
  isEditing.value = false
}

const openProfileImagePicker = () => profileImageInput.value?.click()

const selectProfileImage = (event) => {
  const file = event.target.files?.[0]
  profileImageError.value = ''
  if (!file) return
  if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
    profileImageError.value = 'JPEG, PNG, WebP 형식의 이미지만 사용할 수 있어요.'
    event.target.value = ''
    return
  }
  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    profileImageError.value = '프로필 이미지는 5MB 이하만 사용할 수 있어요.'
    event.target.value = ''
    return
  }

  releaseProfileImagePreview()
  profileImage.value = file
  removeProfileImage.value = false
  profileImagePreviewUrl.value = URL.createObjectURL(file)
}

const resetProfileImage = () => {
  releaseProfileImagePreview()
  profileImage.value = null
  profileImageError.value = ''
  removeProfileImage.value = true
  if (profileImageInput.value) profileImageInput.value.value = ''
}

const save = async () => {
  nicknameError.value = ''
  nicknameError.value = usernameValidationMessage(nickname.value)
  if (nicknameError.value) return
  if (profileImageError.value) return
  try {
    await auth.updateProfile({
      nickname: nickname.value.trim(),
      profileImage: profileImage.value,
      removeProfileImage: removeProfileImage.value,
    })
    releaseProfileImagePreview()
    isEditing.value = false
  } catch (caught) {
    nicknameError.value = caught?.payload?.message || '프로필 수정에 실패했어요. 잠시 후 다시 시도해주세요.'
  }
}
const withdrawing = ref(false)
const withdrawError = ref('')
const withdraw = async () => {
  if (withdrawing.value) return
  if (!window.confirm('정말 회원 탈퇴하시겠어요? 모든 연습 기록이 삭제됩니다.')) return
  withdrawing.value = true
  withdrawError.value = ''
  try {
    await auth.withdraw()
    router.push('/')
  } catch (caught) {
    withdrawError.value = caught?.payload?.message || caught?.message || '회원 탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.'
  } finally {
    withdrawing.value = false
  }
}

onMounted(async () => {
  try {
    await auth.loadMe()
  } catch {
    // 조회 실패해도 기존 로컬 사용자 정보로 화면은 그대로 보여준다.
  }
  if (route.query.edit === '1') enterEdit()
})

onBeforeUnmount(releaseProfileImagePreview)
</script>

<template>
  <section class="mypage-panel">
    <div v-if="!isEditing">
          <header class="mypage-content-head">
            <div>
              <h2>내 정보</h2>
              <p>프로필과 계정 정보를 한눈에 확인할 수 있어요.</p>
            </div>
          </header>

          <div class="mypage-profile-surface">
            <div class="avatar">
              <img
                v-if="user.profileImageUrl"
                :key="auth.profileImageIdentity"
                data-testid="profile-image-view"
                :src="user.profileImageUrl"
                :alt="`${user.nickname} 프로필 이미지`"
              />
              <span v-else>{{ initial }}</span>
            </div>
            <div class="name-block">
              <strong :title="user.nickname">{{ user.nickname }}</strong>
              <span :title="user.email">{{ user.email }}</span>
            </div>
            <button type="button" class="btn-primary mypage-primary-action" @click="enterEdit">프로필 수정하기</button>
          </div>

          <h3 class="mypage-section-title">계정 정보</h3>
          <div class="account-info-grid">
            <div class="account-info-box">
              <small>가입 이메일</small>
              <strong :title="user.email">{{ user.email }}</strong>
            </div>
            <div class="account-info-box">
              <small>가입일</small>
              <strong>{{ accountCreatedAt }}</strong>
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
              <button
                type="button"
                class="avatar-upload"
                aria-label="프로필 이미지 선택"
                @click="openProfileImagePicker"
              >
                <img
                  v-if="editingProfileImageUrl"
                  :key="editingProfileImageKey"
                  data-testid="profile-image-preview"
                  :src="editingProfileImageUrl"
                  :alt="`${user.nickname} 프로필 이미지 미리보기`"
                />
                <span v-else>{{ initial }}</span>
                <div class="overlay">이미지 변경</div>
              </button>
              <input
                ref="profileImageInput"
                data-testid="profile-image-input"
                class="profile-image-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="selectProfileImage"
              />
              <button
                v-if="editingProfileImageUrl"
                type="button"
                class="profile-image-reset"
                data-testid="remove-profile-image"
                @click="resetProfileImage"
              >기본 이미지로 되돌리기</button>
              <small
                v-if="profileImageError"
                data-testid="profile-image-error"
                class="field-error profile-image-error"
              >{{ profileImageError }}</small>
            </div>

            <div class="mypage-edit-form">
              <div class="form-field" :class="{ 'field-invalid': nicknameError }">
                <label for="nickname">닉네임</label>
                <div class="limited-field is-inline-field">
                  <input id="nickname" v-model="nickname" v-grapheme-max="NICKNAME_MAX_LENGTH" type="text" @input="onNicknameInput" />
                  <small class="field-counter" aria-live="polite">{{ countGraphemes(nickname) }}/{{ NICKNAME_MAX_LENGTH }}</small>
                </div>
                <small v-if="nicknameError" class="field-error" role="alert">{{ nicknameError }}</small>
              </div>
              <div class="form-field">
                <label for="email">이메일</label>
                <input id="email" :value="user.email" type="email" disabled />
              </div>

              <RouterLink to="/mypage/security" class="btn-ghost-sm password-change-btn">비밀번호 변경</RouterLink>
              <small v-if="withdrawError" class="field-error">{{ withdrawError }}</small>

              <div class="profile-actions mypage-edit-actions">
                <button type="button" class="danger-link" :disabled="withdrawing" @click="withdraw">회원 탈퇴</button>
                <div class="mypage-form-actions">
                  <button type="button" class="btn-secondary" data-testid="cancel-profile-edit" @click="cancelEdit">취소</button>
                  <button type="submit" class="btn-primary">완료</button>
                </div>
              </div>
            </div>
          </form>
        </div>
  </section>
</template>
