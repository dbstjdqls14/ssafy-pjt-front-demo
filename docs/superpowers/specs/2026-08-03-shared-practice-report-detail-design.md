# 면접·발표 공통 상세 리포트 설계

## 목적

면접과 발표는 서로 다른 리포트 조회 API를 유지한다. 프런트에서는 두 응답을 하나의 공통 화면 모델로 변환하여 요약 점수와 음성·몸짓 그래프를 동일한 화면 구성으로 제공한다. 영상은 재생과 시간 동기화 로직만 공유하고, 질문 중심인 면접과 슬라이드 중심인 발표의 패널 UI는 분리한다.

기준 면접 구현은 프런트 커밋 `520e2326f3de3ab742e9141fa0cbcac97afe1820`이다. 발표 화면은 면접 코드를 복사하지 않고 공통 리포트 컴포넌트를 사용한다.

## 범위

### 포함

- 면접·발표 리포트 API 호출 경계 분리
- API별 응답 정규화
- 공통 리포트 화면 모델
- 공통 요약 점수, 음성 그래프와 몸짓 그래프
- 공통 영상 재생·시간 이동 controller
- 면접·발표 전용 영상 패널
- 선택 구간과 영상 절대 시간축 동기화
- 발표 슬라이드 이미지·핵심 내용·AI 피드백
- 면접 질문·답변·질문별 피드백
- 발표 질의응답 피드백
- 로딩, 빈 데이터, 조회 실패 처리

### 제외

- Spring·FastAPI와 데이터베이스 변경
- 발표 리포트 생성 로직
- Mock 리포트 생성 및 API 실패 시 Mock 전환
- 슬라이드 발화 문구 하이라이팅
- 발표 Q&A 영상 구간 이동

## API 경계

두 도메인은 API 모듈을 공유하지 않는다.

- 면접 조회는 `interviewApi.getReport(interviewId)`가 `GET /interviews/{interviewId}/interview-report`를 호출한다.
- 발표 조회는 `presentationApi.getReport(reportIdentifier)`가 발표 전용 리포트 조회 API를 호출한다.
- 공통 화면은 URL, 식별자 종류와 원본 응답 구조를 알지 않는다.
- 라우트가 가진 기록 ID를 도메인 ID로 임의 변환하지 않는다. 목록·상세 응답이 제공한 면접 또는 발표 식별자를 각 API에 전달한다.

현재 로컬 Spring 코드에는 발표 리포트 조회 컨트롤러가 없으므로 발표 API 호출의 실제 성공 검증은 해당 엔드포인트가 배포된 환경에서 수행한다. 엔드포인트가 없는 환경에서는 오류 상태를 표시하며 Mock으로 대체하지 않는다.

## 아키텍처

```text
interviewApi.getReport()    -> normalizeInterviewReport()    ┐
                                                               ├-> PracticeReportViewModel
presentationApi.getReport() -> normalizePresentationReport() ┘
                                                                    |
                                                                    v
                                                       공통 상세 리포트 화면
```

### API별 adapter

`normalizeInterviewReport`는 질문을 공통 `sections`로 변환한다. `normalizePresentationReport`는 슬라이드를 `sections`로 변환하고, 발표 전체 기준 `speechAnalysis.windows`와 `gestureSeries`를 슬라이드 시간 범위별로 자른다.

adapter는 다음 책임만 가진다.

- 필드명과 단위 정규화
- 누락 가능한 값의 안전한 기본값 처리
- 선택 구간별 음성·몸짓 데이터 생성
- 상대 시간과 절대 시간 오프셋 보존

화면 문구, DOM 상태와 영상 객체는 adapter가 다루지 않는다.

### 공통 화면 컴포넌트

공통 화면은 다음을 렌더링한다.

- 연습 제목, 날짜, 녹화 시간과 구간 개수
- 종합·음성·몸짓·내용 점수
- 선택 구간 탭과 이전·다음 이동
- 음성 분석 그래프
- 몸짓 분석 그래프
- 선택 구간 전용 콘텐츠 영역

면접과 발표의 전용 영역은 슬롯 또는 작은 도메인 컴포넌트로 분리한다.

- 면접: 질문, 사용자 답변, 질문별 피드백
- 발표: 슬라이드 이미지, 핵심 내용, AI 피드백
- 발표 Q&A: 영상 이동 없이 문답과 피드백만 표시

### 영상 controller와 도메인 패널

공통 `VideoController` 또는 composable은 다음 기능만 소유한다.

- 전체 녹화 영상 재생·일시정지
- 절대 시간 seek
- 현재 재생 시간과 전체 길이 관리
- 그래프 상대 시간을 영상 절대 시간으로 변환
- 영상 재생 위치에 맞는 현재 section 동기화

영상 주변 레이아웃과 탐색 UI는 공유 controller를 사용하는 별도 패널로 구성한다.

`InterviewVideoPanel`은 전체 면접 영상과 현재 질문·답변 자막을 보여준다. 질문 이전·다음 이동은 해당 질문 시작 시각으로 영상을 이동하며, 재생 시각에 맞춰 현재 질문을 자동 선택한다.

`PresentationVideoPanel`은 왼쪽에 전체 발표 녹화 영상을 표시하고, 영상 아래에 슬라이드 썸네일 목록을 제공한다. 오른쪽에는 현재 슬라이드 제목·이미지 정보와 해당 슬라이드에서 인식된 발화를 표시한다. 썸네일을 선택하면 해당 슬라이드의 시작 시각으로 이동하고, 영상 재생 중에는 현재 시각에 해당하는 슬라이드를 자동 선택한다.

발표 Q&A는 녹화 대상이 아니므로 `PresentationVideoPanel`의 시간축, 자막과 seek 동작에 포함하지 않는다.

## 공통 화면 모델

```js
{
  type: 'interview' | 'presentation',
  identity: {
    practiceId: Number | String,
    domainId: Number | String,
  },
  practice: {
    title: String,
    description: String,
    practicedAt: String,
    durationSec: Number,
    sectionCount: Number,
  },
  scores: {
    overall: Number | null,
    folderAverage: Number | null,
    folderDelta: Number | null,
    voice: Number | null,
    video: Number | null,
    content: Number | null,
    questionAnswer: Number | null,
  },
  media: {
    videoPlaybackUrl: String | null,
  },
  sections: [
    {
      id: Number | String,
      index: Number,
      title: String,
      absoluteStartSec: Number,
      absoluteEndSec: Number,
      durationSec: Number,
      voiceSeries: Object | null,
      gestureSeries: Object | null,
      transcriptSegments: Array,
      presentation: Object | null,
      interview: Object | null,
      feedback: Object | null,
    }
  ],
  questionAnswers: Array,
}
```

점수가 응답에 없으면 임의로 계산하지 않고 `null`로 유지한다. 화면은 해당 지표를 `-` 또는 분석 결과 없음으로 표시한다.

## 시간축 규칙

영상은 연습 전체 기준 절대 시간을 사용한다. 그래프는 선택한 질문 또는 슬라이드의 시작을 `0초`로 하는 상대 시간을 사용한다.

```js
absoluteVideoSec = section.absoluteStartSec + relativeGraphSec
relativeGraphSec = absoluteVideoSec - section.absoluteStartSec
```

그래프를 클릭하면 첫 번째 식으로 영상 위치를 변경한다. 영상의 `timeupdate`에서는 절대 시각을 포함하는 구간을 찾아 선택 질문 또는 슬라이드를 동기화한다. 이 계산은 공통 controller가 담당하고, 동기화 결과를 표시하는 질문 목록과 슬라이드 썸네일은 각 도메인 패널이 담당한다.

### 발표 구간 매핑

발표 adapter는 슬라이드의 `startTimeSec`와 `endTimeSec`를 기준으로 다음 데이터를 자른다.

- `speechAnalysis.windows`: 슬라이드와 시간이 겹치는 window
- `gestureSeries.buckets`: 슬라이드와 시간이 겹치는 bucket
- `gestureSeries.gazeEvents`: 슬라이드 범위 안의 event
- `audioStt.segments`: 슬라이드 ID가 같거나 시간이 슬라이드 범위와 겹치는 segment

잘린 데이터의 시작·종료 시각에서 슬라이드 시작 시각을 빼 그래프 상대 시간으로 변환한다. 원본 절대 시각은 영상 이동에 사용하기 위해 section에 남긴다.

슬라이드 재방문은 백엔드가 최종 슬라이드 구간 또는 슬라이드별 분석 데이터로 정리해 준다는 계약을 따른다. 하나의 연속된 `startTimeSec`·`endTimeSec`만으로 재방문을 표현할 수 없는 경우에는 백엔드가 방문 구간 배열을 제공해야 하며, 프런트는 그 구간들의 데이터를 같은 슬라이드 section에 합친다.

### 몸짓 데이터

면접 기준과 동일하게 `tiltPct`는 자세 안정도로 역산하지 않고 `기울기 %`로 표시한다.

```js
{
  buckets: [{ startSec, endSec, tiltPercent }],
  gazeCount,
  gazeEvents: [{ atSec }],
}
```

`tiltPercent`는 `tiltPercent ?? tiltPct ?? 0`으로 정규화한다. `gazeCount`가 없으면 정규화된 `gazeEvents.length`를 사용한다.

## 발표 전용 콘텐츠

슬라이드 section은 다음 정보를 가진다.

```js
{
  presentation: {
    slideId,
    slideNumber,
    imageUrl,
    coreContent,
  },
  feedback: {
    score,
    content,
  }
}
```

하단 슬라이드 내용 피드백은 `feedback.content`만 일반 문단으로 표시한다. 원문 발화를 다시 출력하거나 문제 구간에 밑줄·색상 하이라이팅을 적용하지 않는다.

## 오류와 빈 상태

- 조회 중에는 리포트 로딩 상태를 표시한다.
- 인증 오류는 공통 API 클라이언트의 기존 401 처리를 따른다.
- 4xx·5xx·네트워크 오류는 오류 메시지와 다시 시도 동작을 제공한다.
- 영상 URL이 없으면 영상 없음 상태를 표시하되 나머지 리포트는 유지한다.
- 특정 section에 음성 또는 몸짓 데이터가 없으면 해당 그래프만 빈 상태로 표시한다.
- API 실패를 Mock 데이터로 숨기지 않는다.
- 이전 응답이 남아 다른 기록의 데이터처럼 보이지 않도록 조회 식별자가 바뀔 때 기존 상세 상태를 초기화한다.

## 테스트와 완료 조건

### 정규화 테스트

- 면접·발표 응답이 같은 `PracticeReportViewModel` 계약으로 변환된다.
- `tiltPct`가 `tiltPercent`로 보존된다.
- 발표 전체 window, bucket과 gaze event가 슬라이드 범위별 상대 시간으로 변환된다.
- 경계에 걸친 10초 구간이 잘리지 않거나 중복 누락되지 않는다.
- 점수와 영상 URL이 없을 때 값을 꾸며내지 않는다.

### 화면 테스트

- 면접과 발표가 동일한 요약·그래프 레이아웃을 사용한다.
- 면접 영상 패널은 질문·답변 자막과 질문 이동을 제공한다.
- 발표 영상 패널은 왼쪽 영상, 하단 썸네일과 오른쪽 현재 슬라이드 발화를 제공한다.
- 선택 질문·슬라이드 변경 시 해당 그래프와 콘텐츠가 갱신된다.
- 그래프 클릭이 올바른 영상 절대 시각으로 이동한다.
- 영상 재생 위치가 현재 질문·슬라이드를 동기화한다.
- 발표 피드백에는 AI 피드백 문구만 표시되고 발화 하이라이팅이 없다.
- 발표 Q&A 피드백은 영상 이동을 제공하지 않는다.
- 로딩, 빈 데이터와 조회 실패 화면이 구분된다.

### 회귀 검증

- 기준 커밋의 면접 질문 이동, 그래프 끝 드래그와 영상 동기화 동작을 유지한다.
- 면접 녹화·완료·10초 음성 분석 흐름은 변경하지 않는다.
- 발표 업로드·녹화·완료 흐름은 변경하지 않는다.
- `npm test`와 `npm run build`가 통과한다.
- 면접·발표 상세 리포트를 실제 렌더링하여 주요 상호작용을 확인한다.

## 구현 원칙

- 기준 커밋의 큰 면접 상세 View를 발표에 복사하지 않는다.
- 하나의 View에 도메인 조건문을 누적하지 않는다.
- 그래프 계산과 영상 시간 동기화는 공통 composable 또는 controller로 추출한다.
- 면접·발표의 영상 패널 DOM과 전용 탐색 UI는 하나의 컴포넌트에 조건문으로 합치지 않는다.
- API별 원본 계약은 adapter 경계 밖으로 노출하지 않는다.
- 현재 작업 트리의 다른 기능 변경과 Mock 데이터를 이번 작업에 포함하지 않는다.
