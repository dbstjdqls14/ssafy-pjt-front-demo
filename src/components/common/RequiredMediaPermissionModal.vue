<script setup>
defineProps({
  busy: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['confirm'])
</script>

<template>
  <div
    class="required-media-permission-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="requiredMediaPermissionTitle"
    aria-describedby="requiredMediaPermissionDescription"
  >
    <div class="required-media-permission-dialog">
      <h2 id="requiredMediaPermissionTitle">카메라와 마이크 권한이 필요합니다.</h2>
      <p id="requiredMediaPermissionDescription">
        주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.
      </p>
      <button
        type="button"
        :disabled="busy"
        data-testid="required-media-permission-confirm"
        @click="$emit('confirm')"
      >
        {{ busy ? '확인 중…' : '확인' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.required-media-permission-modal {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(12, 16, 39, .72);
}

.required-media-permission-dialog {
  width: min(360px, 100%);
  padding: 26px 26px 20px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(16, 20, 46, .3);
  text-align: center;
}

.required-media-permission-dialog h2 {
  margin: 0;
  color: #1b1f45;
  font-size: 18px;
  font-weight: 850;
}

.required-media-permission-dialog p {
  margin: 10px 0 0;
  color: #5a6480;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.6;
}

.required-media-permission-dialog button {
  width: 100%;
  min-height: 44px;
  margin-top: 20px;
  border: 0;
  border-radius: 12px;
  background: #5968dc;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.required-media-permission-dialog button:hover:not(:disabled) {
  background: #4e5ed0;
}

.required-media-permission-dialog button:disabled {
  cursor: wait;
  opacity: .6;
}
</style>
