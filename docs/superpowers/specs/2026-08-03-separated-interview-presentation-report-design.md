# 면접 기준선 보호 및 발표 Complete·리포트 분리 설계

## 목적

면접 기능은 Git 커밋 `520e2326f3de3ab742e9141fa0cbcac97afe1820`을 기준선으로 고정한다. 발표 기능은 면접의 녹음, 10초 WAV 분석, 그래프 및 영상 동기화 동작을 기준으로 삼되 발표 전용 파일에서 구현한다. 면접과 발표 리포트를 하나의 공통 컴포넌트나 공통 화면 모델로 합치지 않는다.

프런트엔드만 수정한다. Spring, FastAPI 및 데이터베이스는 이번 작업에서 수정하지 않는다.

## 확정 기준

- 면접 관련 보호 파일은 `520e2326...`의 내용을 복원하고 발표 구현을 위해 수정하지 않는다.
- 발표는 면접 Store, 면접 API, 면접 리포트 컴포넌트를 사용하지 않는다.
- 발표 complete는 `1a9ae107821d957b6a734485d38098bbda798cf0`의 Spring 계약을 따른다.
- 발표 리포트는 `GET /api/v1/presentations/{presentationId}/presentation-report` 응답을 사용한다.
- 슬라이드 재방문, `visitId`, `slides[].visits[]`는 프런트에서 고려하지 않는다.
- 발표 Q&A는 녹화 영상과 연결하지 않으며 영상 seek 기능을 제공하지 않는다.
- 슬라이드 피드백은 발화문 하이라이팅 없이 AI 피드백 문구만 표시한다.
- 발표에는 API/MOCK 출처 배지나 Mock fallback을 새로 만들지 않는다. 면접의 데이터 처리 방식은 `520e2326...`의 기존 동작을 그대로 유지한다.

## 면접 기준선 보호

다음 파일은 `520e2326...` 기준으로 복원하고 보호한다.

- `src/api/interviewApi.js`
- `src/stores/interviewStore.js`
- `src/views/interview/InterviewSetupView.vue`
- `src/views/interview/InterviewCheckView.vue`
- `src/views/interview/InterviewRecordView.vue`
- `src/views/interview/InterviewAnalyzingView.vue`
- `src/views/interview/InterviewReportView.vue`
- `src/views/interview/InterviewReportDetailView.vue`
- `src/composables/useFaceAnalysis.js`
- `src/composables/useVoicePaceGraph.js`
- `src/composables/useGestureGraph.js`
- `src/utils/interviewEvidence.js`
- `src/utils/interviewTimeline.js`
- `src/utils/interviewReportScores.js`
- `src/assets/styles/views/interview-flow.css`
- `src/assets/styles/views/interview-report.css`

현재 면접 상세 화면에서 사용하는 `PracticeReportSummary`, `PracticeReportAnalysis`, `InterviewVideoPanel`, `useReportVideoController` 의존성은 제거한다. 면접 상세 화면은 `520e2326...`의 독립 구현으로 복원한다.

브랜치 전체 reset이나 커밋 단위 revert는 사용하지 않는다. 보호 파일만 기준 커밋에서 복원하여 마이페이지, 문서 API, 학습 추이 등 다른 변경을 보존한다.

## 발표 녹음과 10초 WAV 분석

발표는 기존 `PcmWavCapture`를 수정하지 않고 사용한다. 이 수집기는 다음 동작을 이미 제공한다.

- 16kHz mono PCM WAV
- 10초 청크와 `sequence=0,1,2...`
- 종료 시 10초 미만 마지막 청크 flush
- 전체 WAV 생성
- 청크 요청 재시도
- 종료 전에 진행 중인 모든 청크 분석 요청 대기

전체 WebM은 기존 `useRecorder` 방식으로 생성한다. 10초 청크는 기존 `POST /api/v1/practices/{practiceId}/audio-analysis`로 보낸다. 청크 응답은 발표 녹화 화면의 실시간 분석 영역에 표시한다.

발표 녹화 종료 순서는 다음으로 고정한다.

1. Chrome STT를 종료한다.
2. MediaRecorder를 종료해 전체 WebM을 확정한다.
3. PCM 수집기를 종료해 마지막 청크를 flush하고 전체 WAV를 확정한다.
4. 진행 중인 10초 분석 요청이 모두 끝날 때까지 기다린다.
5. 슬라이드별 `text[]`와 `nonverbal`을 확정한다.
6. 발표 complete multipart 요청을 보낸다.
7. 성공 후 발표 완료 화면으로 이동한다.

청크 분석 실패는 전체 녹화를 중단하지 않는다. 실패 상태는 화면에 표시하되 수집된 전체 WAV와 WebM은 complete에 사용한다.

## 발표 Complete 계약

엔드포인트:

```http
POST /api/v1/presentations/{presentationId}/complete
Content-Type: multipart/form-data
```

Multipart part 이름은 다음으로 고정한다.

- `request`: `application/json` Blob
- `audio`: 전체 WAV 파일
- `video`: 전체 WebM 파일

`request` JSON:

```json
{
  "durationMs": 95000,
  "text": [
    {
      "page": 1,
      "timestamp": 0,
      "content": "안녕하세요. 발표를 시작하겠습니다."
    }
  ],
  "nonverbal": {
    "gazeDeviationCount": 5,
    "postureTiltPercent": 14,
    "sampleCount": 320,
    "gazeEvents": [
      { "atSec": 12 }
    ],
    "tiltBuckets": [
      { "startSec": 0, "endSec": 10, "tiltPct": 20 }
    ]
  }
}
```

프런트는 `request`, `audio`, `video`를 항상 보낸다. 현재 Spring 컨트롤러에서 part가 선택 사항이더라도 프런트 계약은 필수로 취급한다. complete가 실패하면 같은 Blob과 JSON을 유지하여 재시도할 수 있게 하고 성공 화면으로 이동하지 않는다.

`1a9ae107...`의 백엔드는 `text[]`를 DTO로 받지만 서비스에서 저장하거나 사용하지 않는다. 프런트는 합의된 계약을 유지하여 `text[]`를 전송하되, 현재 백엔드에서 리포트 데이터로 반영되지 않을 수 있음을 오류로 위장하지 않는다.

## 발표 리포트 API

```http
GET /api/v1/presentations/{presentationId}/presentation-report
Authorization: Bearer {accessToken}
```

프런트는 다음 최상위 응답을 사용한다.

- `practice`
- `presentation`
- `score`
- `media`
- `audioStt`
- `speechAnalysis`
- `slides`
- `questionAnswers`
- 선택적 `gestureSeries`

`1a9ae107...`의 `PresentationReportResponse`에는 아직 `gestureSeries`가 포함되지 않는다. 프런트 normalizer는 필드가 있으면 몸짓 그래프를 만들고, 없으면 몸짓 그래프만 데이터 없음 상태로 표시한다. 음성, 영상, 슬라이드 피드백과 Q&A는 계속 렌더링한다.

## 발표 전용 리포트 구조

발표 리포트는 다음 발표 전용 단위가 소유한다.

```text
src/views/presentation/PresentationReportDetailView.vue
src/components/presentation-report/PresentationReportSummary.vue
src/components/presentation-report/PresentationReportAnalysis.vue
src/components/presentation-report/PresentationReportVideoPanel.vue
src/composables/usePresentationVoicePaceGraph.js
src/composables/usePresentationGestureGraph.js
src/composables/usePresentationReportVideo.js
src/api/normalizers/presentationReport.js
src/assets/styles/views/presentation-report.css
```

면접의 그래프 및 영상 로직을 참조하여 발표 전용 파일에 구현한다. 새 공통 리포트 컴포넌트, 공통 리포트 모델, 공통 영상 컨트롤러는 만들지 않는다.

## 음성 그래프

발표 API의 `speechAnalysis.windows[]`를 `startTimeMs` 순으로 정렬한다. 각 Window를 슬라이드의 `[startTimeSec,endTimeSec)`와 교차시켜 선택한 슬라이드 구간에 해당하는 부분만 표시한다.

- 계단형 그래프를 사용한다.
- 전체 및 Window 값의 단위는 WPM이다.
- WPM을 초당 음절로 변환하지 않는다.
- 최저·최고 구간은 `slowestWindow`, `fastestWindow` 또는 Window 목록에서 계산한다.
- 정확한 추임새 발생 시각이 없으므로 추임새 점을 만들지 않는다.
- `fillerCount`는 해당 10초 Window의 횟수로 표시한다.
- `silenceDetected`와 `silenceDurationMs`는 해당 Window에서 침묵이 감지됐다는 범위 정보로 표시한다.
- 정확한 침묵 시작·종료 시각을 임의로 생성하지 않는다.

그래프 클릭과 playhead 드래그는 선택한 슬라이드의 `startTimeSec + localSec`로 영상 시각을 이동한다. 슬라이드 끝을 넘는 값은 `endTimeSec`로 제한한다.

## 몸짓 그래프

`gestureSeries`가 있으면 다음 계약을 사용한다.

```json
{
  "buckets": [
    { "startSec": 0, "endSec": 10, "tiltPct": 20 }
  ],
  "gazeCount": 1,
  "gazeEvents": [
    { "atSec": 12 }
  ]
}
```

`buckets[]`를 슬라이드 시간 범위와 교차시켜 자세 그래프를 그리고, `gazeEvents[]` 중 슬라이드 범위에 포함되는 시각만 시선 이탈 지점으로 표시한다. `tiltPct`는 그대로 사용하며 다른 자세 점수로 변환하지 않는다.

## 슬라이드와 시간 매핑

재방문은 고려하지 않는다. 각 슬라이드는 다음 한 개의 연속 구간만 가진다.

```json
{
  "slideId": 101,
  "startTimeSec": 0,
  "endTimeSec": 12
}
```

- 슬라이드 선택 시 `startTimeSec`로 영상을 이동한다.
- 영상 재생 시 현재 시간이 포함되는 슬라이드를 선택한다.
- 음성 Window와 몸짓 Bucket은 슬라이드 시간 범위와의 교차 구간으로 표시한다.
- STT 문장은 `audioStt.segments[].slideId`로 슬라이드에 배치한다.
- `visitId`, `visits`, 재방문 구간 연결 및 재방문 추론 로직은 만들지 않는다.

## 영상과 피드백

발표 영상은 `media.video.playbackUrl`을 사용한다. 영상 재생, 일시정지, scrub, 그래프 seek와 영상 시각 동기화는 면접 `520e2326...`의 동작과 같게 구현하되 발표 전용 코드가 소유한다.

영상 주변에는 발표에 필요한 정보만 표시한다.

- 현재 슬라이드 이미지와 제목
- 현재 슬라이드 STT 문장
- 이전·다음 슬라이드 이동
- 전체 발표 영상 재생 시간

슬라이드 내용 피드백은 `slides[].feedback.content`만 표시한다. Q&A는 `questionAnswers[]`의 질문, 사용자 답변 및 `feedback.content`를 표시하며 영상 이동 기능을 제공하지 않는다.

## 오류 처리

- complete 4xx/5xx 또는 네트워크 실패 시 리포트 화면으로 이동하지 않는다.
- complete 재시도를 위해 WAV, WebM 및 request payload를 메모리에 유지한다.
- 리포트 GET 실패 시 다른 도메인의 데이터나 Mock으로 대체하지 않는다.
- 리포트의 일부 필드가 없으면 해당 영역만 데이터 없음 상태로 표시한다.
- 영상 URL이 없으면 영상 없음 상태를 표시하지만 점수와 피드백은 계속 표시한다.
- `gestureSeries`가 없으면 몸짓 탭만 데이터 없음 상태로 표시한다.

## 검증 기준

1. 면접 보호 파일이 `520e2326...`과 0 diff다.
2. 면접 화면이 발표 전용 파일을 import하지 않는다.
3. 발표 화면이 면접 Store, 면접 API 및 면접 리포트 컴포넌트를 import하지 않는다.
4. complete FormData의 part 이름이 `request`, `audio`, `video`다.
5. request JSON에 `durationMs`, `text`, `nonverbal`이 정확히 들어간다.
6. 전체 WAV는 `audio/wav`, 전체 영상은 `video/webm`으로 전송된다.
7. 마지막 WAV 청크와 진행 중인 청크 요청이 끝난 뒤 complete가 호출된다.
8. 슬라이드 재방문 및 `visitId` 관련 코드가 없다.
9. 발표 리포트가 `startTimeSec/endTimeSec` 기준으로 음성·몸짓 데이터를 분리한다.
10. `gestureSeries`가 없는 응답에서도 나머지 리포트가 렌더링된다.
11. 발표 Q&A에 영상 seek가 없다.
12. 관련 Vitest, 전체 `npm test`, `npm run build`가 통과한다.
13. 면접 보호 파일과 면접 화면의 데이터 처리 동작이 `520e2326...`과 동일하다.
14. 발표 리포트의 영상, 그래프 클릭, 슬라이드 전환을 브라우저에서 확인한다.

## 제외 범위

- Spring의 `text[]` 저장·활용 추가
- Spring의 `gestureSeries` 응답 추가
- Spring complete의 선택적 multipart part를 필수로 변경
- Spring의 비언어 로그 재시도 중복 문제 수정
- FastAPI 및 데이터베이스 수정
- 슬라이드 재방문 지원
- 리포트 공통 컴포넌트 또는 공통 화면 모델 도입
