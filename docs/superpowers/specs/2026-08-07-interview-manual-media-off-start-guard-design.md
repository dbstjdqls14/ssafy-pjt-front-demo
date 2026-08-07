# Interview Manual Media-Off Start Guard Design

## Goal

면접 녹화 화면에서 사용자가 사이트 내부의 카메라 또는 마이크 버튼으로 장치를 끈 뒤 `면접 시작`을 눌러도 장치를 자동으로 다시 켜지 않는다.

## Behavior

- 브라우저 권한이 `denied`이면 기존 권한 필요 모달을 표시한다.
- 권한은 허용되어 있지만 `camOn` 또는 `micOn`이 꺼져 있으면 발표와 동일한 장치 OFF 안내 모달을 표시한다.
- 장치 OFF 안내 중에는 카운트다운, 녹화, TTS, MediaPipe 분석을 시작하지 않는다.
- 사용자가 화면의 카메라·마이크 버튼으로 직접 장치를 켠 뒤 `면접 시작`을 다시 눌러야 한다.
- 진행 중 실제 장치 유실 후 `확인`으로 복구하는 기존 `requestDevicesAfterLoss` 흐름은 유지한다.

## Implementation

`InterviewRecordView`의 `prepareStartCountdown`에서 `connectCaptureSources`보다 먼저 권한 상태와 `camOn`/`micOn`을 순서대로 판정한다. 권한 차단은 `deviceBlocked`, 내부 OFF는 별도 안내 상태로 처리한다. 내부 OFF 분기에서는 `requestRequiredDevices`를 호출하지 않는다.

## Validation

- 사이트 내부에서 카메라와 마이크를 끈 후 시작하면 안내 모달이 보이고 장치 재요청 및 녹화가 발생하지 않는다.
- 브라우저 권한 차단은 기존 권한 필요 모달을 계속 사용한다.
- 장치를 직접 켠 후 다시 시작하면 기존 5초 카운트다운이 진행된다.
