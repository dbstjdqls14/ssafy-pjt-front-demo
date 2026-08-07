# AIVO 프론트엔드 API 연동 명세

> 팀 공유용 문서 · 프론트 화면에서 사용하는 요청과 필요한 응답을 정리한다.
>
> 현재 작업 공간에는 백엔드 코드가 없으므로 서버 구현 여부가 아닌 **프론트 호출 상태**를 기준으로 작성했다.

- ✅ 화면·Store에서 호출 중
- 🟡 API 함수만 있거나 일부 연결
- ⬜ 프론트 화면은 있으나 API 정의 필요

## 1. 공통 통신 방식

| 항목 | 현재 프론트 기준 |
|---|---|
| Base URL | `VITE_API_BASE_URL`, 미설정 시 `/api/v1` |
| 인증 | 모든 요청에 `credentials: include` 적용 |
| JSON 요청 | 객체를 JSON 문자열로 변환하고 `Content-Type: application/json` 적용 |
| 파일 요청 | `FormData` 사용, 브라우저가 multipart boundary 설정 |
| 성공 응답 | JSON 또는 텍스트 원문 반환 |
| 실패 응답 | `ApiError`에 HTTP `status`와 서버 `payload` 저장 |
| 개발용 대체 | `withMock()`은 네트워크 실패·미구현 endpoint·SPA fallback일 때만 로컬 Mock 반환 |

권장 성공 응답:

```json
{
  "data": {}
}
```

권장 오류 응답:

```json
{
  "code": "ERROR_CODE",
  "message": "사용자에게 표시할 메시지"
}
```

## 2. 인증·사용자

| 상태 | 사용 화면 | API(Method·Endpoint) | 요청 데이터(Request) | 응답 데이터(Response) |
|---|---|---|---|---|
| ✅ | 로그인 | `POST /auth/login` | `email`, `password` | `user.id`, `user.nickname`, `user.email` |
| ✅ | 공통 헤더 | `POST /auth/logout` | 없음 | `204` 또는 성공 응답 |
| 🟡 | 앱 사용자 복구 | `GET /users/me` | 없음 | 로그인 사용자 정보 |
| 🟡 | 회원가입 | `POST /auth/register` | `nickname`, `email`, `password` | 생성된 사용자 정보 |
| ✅ | 지원 자료 목록 | `GET /users/me/documents` | 없음 | 이력서·포트폴리오 배열 |
| ✅ | 지원 자료 상세 | `GET /users/me/documents/{documentId}` | 없음 | 선택한 자료와 미리보기·다운로드 정보 |
| ✅ | 지원 자료 업로드 | `POST /users/me/documents` | multipart `file`, `type` | `documentId`, 파일 정보 |
| ✅ | 지원 자료 삭제 | `DELETE /users/me/documents/{documentId}` | 없음 | `204` 또는 성공 응답 |
| ⬜ | 계정 찾기 | `POST /auth/find-id` | 식별 정보 | 아이디 찾기 결과 |
| ⬜ | 비밀번호 재설정 | `POST /auth/password-reset/requests` | `email` | 재설정 메일 발송 결과 |
| ⬜ | 프로필 수정 | `PATCH /users/me` | `nickname` 등 | 수정된 사용자 정보 |
| ⬜ | 비밀번호 변경 | `PATCH /users/me/password` | `currentPassword`, `newPassword` | `204` 또는 성공 응답 |
| ⬜ | 이메일 중복확인 | `GET /auth/check-email?email=` | `email` | 사용 가능 여부 |
| ⬜ | 학습 추이 | `GET /users/me/stats?type=&period=` | `type`, `period` | 기간별 종합점수·연습량 추이 |

## 3. 연습 폴더

| 상태 | 사용 화면 | API(Method·Endpoint) | 요청 데이터(Request) | 응답 데이터(Response) |
|---|---|---|---|---|
| ✅ | 폴더 선택 | `GET /practice-folders` | `type`, `keyword`, 페이지 조건 | 폴더 배열과 전체 개수 |
| ✅ | 폴더 생성 | `POST /practice-folders` | `name`, `type`, `description` | `folderId`, `name`, `type` |
| 🟡 | 폴더명 변경 | `PATCH /practice-folders/{folderId}` | `name` | 수정된 폴더 정보 |
| 🟡 | 폴더 삭제 | `DELETE /practice-folders/{folderId}` | 없음 | `204` |

폴더 화면은 API 응답을 우선 사용하고 개발 서버가 연결되지 않으면 Mock으로 대체합니다. 선택·생성한 `folderId`는 발표·면접 세션 생성 요청에 함께 전달합니다.

## 4. 발표 연습

| 상태 | 호출 시점 | API(Method·Endpoint) | 요청 데이터(Request) | 응답 데이터(Response) |
|---|---|---|---|---|
| ✅ | 발표 설정 시작 | `POST /presentation-sessions` | `title`, `description`, `targetDurationSeconds`, `qnaEnabled` | `sessionId`, `status` |
| 🟡 | 새로고침 복구 | `GET /presentation-sessions/{sessionId}` | 없음 | 설정·슬라이드·진행 상태 |
| ✅ | 설정·상태 변경 | `PATCH /presentation-sessions/{sessionId}` | 발표 설정 또는 `status` | 갱신된 세션 상태 |
| ✅ | 발표 자료 업로드 | `POST /presentation-sessions/{sessionId}/slides` | multipart `file` | 이미지 변환이 완료된 `slides` 배열 |
| ✅ | 슬라이드 설정 저장 | `PATCH /presentation-sessions/{sessionId}/slides/{slideId}` | `keyPoints`, `excluded` | 수정된 슬라이드 |
| ✅ | 슬라이드 전환 | `POST /presentation-sessions/{sessionId}/slide-events` | 슬라이드 ID·인덱스·시작 시간 | 저장된 이벤트 또는 `204` |
| ✅ | 발표 녹화 종료 | `POST /presentation-sessions/{sessionId}/recordings` | multipart `recording`, `metadata` | `recordingId` |
| ✅ | 발표·Q&A 완료 | `POST /presentation-sessions/{sessionId}/complete` | 녹화·분석·Q&A 결과 | `status`, `reportId` |
| ✅ | 결과 화면 진입 | `GET /presentation-sessions/{sessionId}/report` | 없음 | 발표 리포트 |
| ⬜ | 청중 질문 생성 | `POST /presentation-sessions/{sessionId}/qna/questions` | 세션·슬라이드 컨텍스트 | 생성된 질문 목록 |
| ⬜ | 청중 답변 평가 | `POST /presentation-sessions/{sessionId}/qna/answers` | 질문별 답변·소요 시간 | 저장·의미 평가 결과 |
| ⬜ | 분석 상태 확인 | `GET /presentation-sessions/{sessionId}/analysis` | 없음 | `status`, `progress`, 실패 메시지 |

발표 API는 화면과 연결되어 있습니다. PDF는 개발 환경에서 브라우저 렌더로 대체할 수 있지만, PPTX는 서버가 슬라이드별 이미지 URL을 반환해야 다음 단계로 진행됩니다. 변환되지 않은 PPTX를 더미 슬라이드로 대체하지 않습니다.

### 슬라이드 응답 필드

| 필드 | 용도 |
|---|---|
| `id` 또는 `slideId` | 대본·발화·체류 시간 연결 |
| `number` | 화면 표시 순서 |
| `title` | 슬라이드 제목 |
| `previewUrl` | 슬라이드 원본 비율 이미지 URL(핵심 내용 입력·확인·녹화·리포트에서 공통 사용) |
| `thumbnailUrl` | 리포트 하단 썸네일 URL, 없으면 `previewUrl` 사용 |
| `extractedText` | 자료에서 추출한 텍스트 |
| `keyPoints` | 사용자가 입력한 핵심 대본 |
| `excluded` | 분석 제외 여부 |

권장 업로드 응답:

```json
{
  "sessionId": "presentation-1",
  "slides": [
    {
      "slideId": "slide-1",
      "number": 1,
      "title": "서비스 소개",
      "previewUrl": "/uploads/presentation-1/slide-1.png",
      "thumbnailUrl": "/uploads/presentation-1/slide-1-thumb.png",
      "extractedText": "슬라이드에서 추출한 텍스트",
      "keyPoints": "",
      "excluded": false
    }
  ]
}
```

### 녹화 metadata

| 필드 | 내용 |
|---|---|
| `durationSeconds` | 전체 발표 시간 |
| `slides` | 슬라이드별 시작·종료·체류 시간 |
| `transcripts` | 발화문·발화 시점·슬라이드 ID |
| `metrics.wpm` | 분당 단어 수 |
| `metrics.fillerCount` | 습관어 횟수 |
| `metrics.gazeHold` | 정면 시선 비율 |
| `metrics.posture` | 자세 점수 |
| `metrics.voice`, `metrics.voiceDb` | 음량 상태와 측정값 |

### 발표 리포트 최소 필드

| 필드 | 화면 사용 위치 |
|---|---|
| `overallScore` | 종합 점수 |
| `durationSeconds` | 발표 시간 |
| `metrics` | WPM·습관어·시선·자세·음성 |
| `highlights` | 잘한 점·주의 항목 카드 |
| `improvements` | 개선 포인트 목록 |
| `slides` | 슬라이드별 발화·피드백과 `previewUrl`·`thumbnailUrl` |
| `qnaResults` | 질문별 답변과 평가 (백엔드 계약 제안·프론트 미구현) |

## 5. 면접 연습

| 상태 | 호출 시점 | API(Method·Endpoint) | 요청 데이터(Request) | 응답 데이터(Response) |
|---|---|---|---|---|
| ✅ | 면접 설정 시작 | `POST /interview-sessions` | 회사·직무·경력·키워드·스타일 | `sessionId`, `status` |
| 🟡 | 새로고침 복구 | `GET /interview-sessions/{sessionId}` | 없음 | 면접 설정·질문·진행 상태 |
| ✅ | 설정 변경 | `PATCH /interview-sessions/{sessionId}` | 변경된 설정·질문 | 갱신된 세션 |
| ✅ | 지원 자료 업로드 | `POST /interview-sessions/{sessionId}/resume` | multipart `file` | 문서 ID·파일명 |
| ✅ | 질문 화면 진입 | `GET /interview-sessions/{sessionId}/questions` | 없음 | `questionId`, 질문, 카테고리, 예상 시간 |
| ⬜ | 질문 생성 | `POST /interview-sessions/{sessionId}/questions/generate` | 자소서·스타일·키워드 | 생성된 질문 목록 |
| ✅ | 녹화 종료 | `POST /interview-sessions/{sessionId}/recordings` | multipart `recording`, `metadata`(질문별 답변 구간 포함) | `recordingId` |
| ✅ | 분석 시작 | `POST /interview-sessions/{sessionId}/complete` | 녹화 시간·질문 개수 | 분석 상태 |
| ✅ | 분석 상태 확인 | `GET /interview-sessions/{sessionId}/analysis` | 없음 | `status`, `progress`, 실패 메시지 |
| ✅ | 리포트 진입 | `GET /interview-sessions/{sessionId}/report` | 없음 | 면접 요약·질문별 결과 |

면접 종료 시 `MediaRecorder`의 Blob 생성이 끝날 때까지 기다린 뒤 녹화 파일과 질문별 답변 구간을 함께 업로드합니다. 저장이 완료된 후에만 분석 화면으로 이동합니다.

### 면접 분석 상태

분석 화면은 `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` 상태와 진행률을 처리하고, 완료 시 같은 `sessionId`로 리포트를 조회합니다.

면접 리포트에서 필요한 주요 데이터:

- 종합 점수와 전체 면접 시간
- 답변 구조·구체성·키워드·시선 점수
- 질문별 답변문과 답변 시간
- 질문별 잘한 점·개선점·추천 답변

## 6. 기록·보관함

| 상태 | 사용 화면 | API(Method·Endpoint) | 요청 데이터(Request) | 응답 데이터(Response) |
|---|---|---|---|---|
| ✅ | 기록 목록 | `GET /reports` | `type`, `keyword`, 검색·필터 조건 | 기록 배열과 전체 개수 |
| ✅ | 상세 리포트 | `GET /reports/{recordId}` | 없음 | 발표 또는 면접 상세 리포트와 `recordingUrl` |
| 🟡 | 폴더 상세 | `GET /practice-folders/{folderId}` | 없음 | 폴더 정보·시도 목록·점수 요약 |
| ⬜ | 기록 제목 변경 | `PATCH /reports/{recordId}` | `title` | 수정된 기록 |
| ⬜ | 기록 삭제 | `DELETE /reports/{recordId}` | 없음 | `204` |
| ⬜ | 폴더 결과 비교 | `GET /practice-folders/{folderId}/comparison` | 없음 | 같은 폴더 연습 결과 비교 |
| ⬜ | 영상 재생 | `GET /recordings/{recordingId}` | 없음 | 상세 리포트 영상 재생 URL |

기록 목록·상세는 API를 우선 조회하고 미연결 개발 환경에서는 로컬 기록으로 대체합니다. 상세 리포트는 `recordingUrl`을 실제 영상 플레이어에 연결하며, 발화·문제 구간 선택 시 해당 재생 시점으로 이동합니다.

## 7. 기준 데이터 (Meta)

면접 설정의 회사·직군·직무·경력·키워드가 현재 상수(`InterviewSetupView`)입니다. 사전 등록 데이터로 전환이 필요합니다.

| 상태 | 사용 화면 | API(Method·Endpoint) | 요청 데이터(Request) | 응답 데이터(Response) |
|---|---|---|---|---|
| ⬜ | 면접 설정 | `GET /meta/companies` | 없음 | 회사 목록 |
| ⬜ | 면접 설정 | `GET /meta/job-fields` | 없음 | 직군 목록 |
| ⬜ | 면접 설정 | `GET /meta/job-positions` | 없음 | 직무 목록 |
| ⬜ | 면접 설정 | `GET /meta/career-levels` | 없음 | 경력 옵션 |
| ⬜ | 면접 설정 | `GET /meta/skill-keywords?q=` | `q` | 기술 키워드 자동완성 |

## 8. 프론트·백엔드 확인 항목

- 응답을 `{ data }`로 감쌀지 원문 객체로 반환할지 통일
- 모든 ID 필드명을 `userId`, `folderId`, `sessionId`, `slideId`, `questionId`, `recordingId`, `reportId`로 통일
- 날짜·시간은 ISO 8601, 영상 내부 시점은 초 단위 숫자로 통일
- 로그인 쿠키, CORS, CSRF 정책 확정
- PDF·PPTX 최대 100MB와 WebM 녹화 업로드 허용 범위 확인
- `401`, `403`, `404`, `409`, `413`, `415`, `500` 오류 응답 확인
- 분석 상태를 `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`로 통일
- 중복 업로드·중복 완료 요청 처리 방식 확인
