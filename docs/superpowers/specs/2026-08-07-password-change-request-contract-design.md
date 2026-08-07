# 비밀번호 변경 요청 계약 수정 설계

## 목표

마이페이지 비밀번호 변경 화면에서 사용자가 입력한 현재 비밀번호, 새 비밀번호, 새 비밀번호 확인값을 백엔드 `PATCH /api/v1/users/me/password` 계약과 동일하게 전송한다. 올바른 값을 입력해도 Spring 요청 검증에서 항상 거절되는 문제를 프런트에서 해결한다.

## 확인된 원인

프런트 화면은 세 값을 모두 입력받지만 현재 요청에는 `currentPassword`와 `newPassword`만 포함한다. 백엔드 `UserPasswordUpdateRequest`는 `currentPassword`, `newPassword`, `newPasswordConfirm` 세 필드를 모두 `@NotBlank`로 요구한다. 누락된 `newPasswordConfirm` 때문에 요청이 서비스 로직에 도달하기 전에 검증 실패한다.

프런트 API 명세도 두 필드만 기록되어 있어 실제 백엔드 계약과 불일치한다.

## 선택한 방식

`MyPageSecurityView`가 이미 검증한 `confirmPw` 값을 `newPasswordConfirm`으로 `auth.changePassword()`에 전달한다. Store와 `userApi`는 payload를 그대로 전달하는 현재 경계를 유지한다.

다음 대안은 사용하지 않는다.

- 백엔드에서 확인 필드를 선택값으로 변경: 서버 검증 계약을 불필요하게 약화한다.
- Store가 `newPassword`를 `newPasswordConfirm`으로 복제: 화면에서 검증한 실제 확인값과 요청 계약이 분리된다.

## 데이터 흐름

1. 사용자가 현재 비밀번호, 새 비밀번호, 새 비밀번호 확인을 입력한다.
2. 화면이 기존 규칙으로 빈 값, 새 비밀번호 강도, 두 새 비밀번호의 일치 여부를 검증한다.
3. 검증 성공 시 다음 JSON 객체를 Store로 전달한다.

```json
{
  "currentPassword": "현재 비밀번호",
  "newPassword": "새 비밀번호",
  "newPasswordConfirm": "새 비밀번호 확인"
}
```

4. `authStore`와 `userApi`가 값을 변경하지 않고 `PATCH /users/me/password` JSON body로 전송한다.
5. 성공 시 기존처럼 마이페이지 수정 화면으로 이동하고, 실패 시 기존 서버 메시지를 표시한다.

## 변경 범위

- `src/views/mypage/MyPageSecurityView.vue`: `newPasswordConfirm` 전달
- `tests/views/MyPageSecurityView.test.js`: 세 필드가 모두 전달되고 성공 경로로 이동하는 회귀 테스트
- `docs/api-specification.md`: 비밀번호 변경 요청 필드 계약 수정

백엔드, 비밀번호 정책, 성공·실패 화면 문구, 라우팅 구조는 변경하지 않는다.

## 검증

- 회귀 테스트를 먼저 작성하고 현재 코드에서 `newPasswordConfirm` 누락으로 실패하는지 확인한다.
- 최소 구현 후 새 테스트와 관련 인증·마이페이지 테스트를 실행한다.
- 전체 Vitest와 Vite 프로덕션 빌드를 실행한다.
- 브라우저 기반 테스트는 수행하지 않는다.
