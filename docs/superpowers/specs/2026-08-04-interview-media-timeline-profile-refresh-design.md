# Interview Media Timeline and Profile Refresh Design

## Goal

면접 질문 TTS 구간을 최종 WebM과 전체 오디오 양쪽에서 동일하게 제외하고, 만료된 프로필 이미지 URL을 프런트에서 안전하게 갱신한다.

## Interview timeline

- 질문 TTS 시작 전에 영상 MediaRecorder, 전체 오디오 MediaRecorder, 10초 PCM 수집기, Chrome STT를 모두 정지한다.
- 두 MediaRecorder의 `pause` 이벤트가 완료된 다음에만 TTS를 재생한다.
- TTS 종료 후 두 MediaRecorder와 PCM 수집기의 재개가 완료된 다음 STT를 재개하고 질문 전환 잠금을 해제한다.
- 답변 `startTime`과 `endTime`은 TTS가 제외된 `recording.elapsedSeconds` 기준으로 `/complete`에 전송한다.
- 리포트는 Pinia 메모리의 `ttsWindows` 보정에 의존하지 않고 서버가 반환한 답변 시각을 그대로 사용한다.
- 질문 전환과 종료는 STT 확정 및 마지막 PCM flush가 완료될 때까지 잠근다.

## Profile image refresh

- 헤더 프로필 이미지 로드 실패 시 인증 스토어가 `/users/me`를 한 번 호출해 새 presigned URL을 받는다.
- 같은 URL에 대해서는 한 번만 갱신을 시도해 오류 반복을 막는다.
- 갱신 후에도 이미지가 없거나 실패하면 닉네임 첫 글자 아바타를 표시한다.
- 백엔드와 URL TTL은 변경하지 않는다.

## Verification

- MediaRecorder의 pause/resume 완료 대기를 단위 테스트한다.
- TTS 중 영상과 오디오 녹화기가 모두 정지하고 TTS 종료 후 모두 재개되는지 화면 단위 테스트한다.
- 리포트가 `sessionTtsWindows` 없이 서버 답변 시각을 사용하는지 검증한다.
- 프로필 이미지 실패 시 한 번만 사용자 정보를 갱신하고 fallback이 표시되는지 검증한다.
- 전체 Vitest와 Vite build를 실행한다. 브라우저 수동 테스트는 사용자가 진행한다.
