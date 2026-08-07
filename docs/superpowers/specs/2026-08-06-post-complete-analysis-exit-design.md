# Complete 이후 분석 화면 이탈 경고 제거 설계

## 목표

발표·면접의 `complete` 요청이 성공한 뒤 서버 분석이 진행되는 구간에서는 이탈 확인 팝업과 브라우저 `beforeunload` 경고를 표시하지 않는다. 화면 하단에서 이미 “페이지를 이동해도 분석은 계속된다”는 사실을 안내하므로 같은 내용을 다시 확인시키지 않는다.

## 범위

- 대상: `InterviewAnalyzingView`, `PresentationAnalyzingView`
- 유지: 녹화 종료 전 확인, 파일 업로드 및 `complete` 요청 중 이탈 보호, 권한 복구 모달
- 제외: 백엔드 API, 분석 폴링 계약, 완료 후 리포트 자동 이동, 녹화·업로드 화면

## 상태 경계

### 면접

면접 분석 화면의 `beginAnalysis()`가 `completeInterview()`를 시작한다. 따라서 화면 진입 직후에는 아직 `complete` 요청이 끝나지 않았을 수 있다.

- `complete` 요청 진행 중: 기존 이탈 경고 유지
- `complete` 응답으로 `reportJob.status`가 `PENDING`, `STT_ANALYZING`, `LLM_ANALYZING` 중 하나가 된 뒤: 이탈 경고 제거
- 이 시점은 기존 `showBackgroundNotice`가 참이 되는 시점과 같다.

### 발표

발표 분석 화면은 `completeSession()`이 끝나면 `stage`를 `report`로 변경한 뒤 리포트 작업 상태를 조회한다.

- `stage`가 `complete` 또는 `questions`: 기존 이탈 경고 유지
- `stage`가 `report`: 첫 리포트 폴링 응답을 기다리는 중이어도 이탈 경고 제거

## 이탈 동작

경고가 제거된 구간에서 라우터 뒤로가기·헤더 이동·브라우저 새로고침은 별도 확인 없이 진행된다. 컴포넌트가 unmount되면 프런트 폴링 타이머만 중지되며, 이미 접수된 서버 분석은 계속된다. 완료된 리포트는 내 기록에서 확인한다.

## 오류 처리

`complete` 요청 실패 상태는 서버 분석 접수 완료로 보지 않는다. 기존 실패 안내를 유지하며 이번 변경에서 재시도 동작을 추가하지 않는다.

## 테스트

- 면접: `complete` 요청이 끝나지 않은 동안에는 기존 이탈 확인을 유지한다.
- 면접: 백그라운드 분석 작업이 확인되면 라우트 이탈과 `beforeunload`를 즉시 허용한다.
- 발표: `complete` 요청 중에는 기존 이탈 확인을 유지한다.
- 발표: `report` 단계에서는 첫 폴링 응답 전에도 라우트 이탈과 `beforeunload`를 즉시 허용한다.
- 기존 분석 완료·실패·타임아웃·리포트 이동 테스트는 그대로 통과해야 한다.
