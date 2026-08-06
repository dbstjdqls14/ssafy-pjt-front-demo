# 자소서·포트폴리오 실제 API 전환 설계

## 목표

마이페이지 `/mypage/documents`에서 자소서와 포트폴리오를 실제 Spring API로 조회·등록·상세 조회·삭제한다. 존재하지 않는 통합 문서 API와 localStorage Mock fallback을 제거하고, `새 자료 등록`에서 사용자가 자료 유형을 선택한 뒤 제목과 PDF를 등록하도록 변경한다.

## 범위

- 자소서와 포트폴리오만 관리한다.
- 발표 자료는 기존 발표 연습 등록 흐름에서 관리하며 이번 화면에 포함하지 않는다.
- 목록, 유형 필터, 등록, 상세 내용 표시, 삭제를 실제 API로 연결한다.
- 백엔드와 DB는 수정하지 않는다.
- 서버 응답에 없는 파일 크기, 원본 파일명, 브라우저 미리보기 URL은 화면에 표시하지 않는다.
- API 실패 시 Mock 데이터로 대체하지 않는다.

## 실제 API 계약

### 자소서

- 목록: `GET /api/v1/resumes`
- 상세: `GET /api/v1/resumes/{resumeId}`
- 등록: `POST /api/v1/resumes/upload`
- 삭제: `DELETE /api/v1/resumes/{resumeId}`
- 등록 multipart 필드: `title`, `file`

### 포트폴리오

- 목록: `GET /api/v1/portfolios`
- 상세: `GET /api/v1/portfolios/{portfolioId}`
- 등록: `POST /api/v1/portfolios/upload`
- 삭제: `DELETE /api/v1/portfolios/{portfolioId}`
- 등록 multipart 필드: `title`, `file`

공통 API 클라이언트가 `/api/v1` 접두사와 Bearer 토큰을 처리하므로 개별 API 모듈에서는 `/resumes`, `/portfolios` 경로를 사용한다.

## 프런트 데이터 모델

자소서와 포트폴리오는 서로 다른 테이블에서 ID가 생성되므로 같은 숫자 ID가 존재할 수 있다. 화면용 ID와 서버 ID를 분리한다.

```js
{
  id: 'resume:3',
  serverId: 3,
  type: 'resume',
  title: '백엔드 개발자 자기소개서',
  createdAt: '2026-07-20T10:30:00',
  updatedAt: '2026-07-20T10:30:00',
  content: '추출된 자소서 전문',
  summary: null,
}
```

포트폴리오는 `id: 'portfolio:3'`, `type: 'portfolio'`, `summary`를 사용하고 `content`는 `null`로 정규화한다.

## Store 구조

`documentsStore`는 다음 상태를 소유한다.

- `resumes`: 실제 자소서 목록
- `portfolios`: 실제 포트폴리오 목록
- `documents`: 두 목록을 `createdAt` 내림차순으로 합친 computed 값
- `loading`: 목록·등록·삭제 진행 상태
- `error`: 사용자에게 표시할 실제 API 오류

Store 액션은 다음 계약을 사용한다.

```js
loadDocuments()
loadDocument(compositeId)
uploadDocument({ type, title, file })
removeDocument(compositeId)
```

- `loadDocuments()`는 `resumeApi.list()`와 `portfolioApi.list()`를 `Promise.all`로 병렬 호출한다.
- `loadDocument()`는 `resume:3` 또는 `portfolio:3`을 파싱해 해당 상세 API를 호출한다.
- `uploadDocument()`는 유형별 upload API 호출 후 해당 유형의 목록을 다시 조회한다. 등록 응답에는 제목과 등록일이 없으므로 응답 객체만으로 카드를 만들지 않는다.
- `removeDocument()`는 유형별 delete API를 호출하고 성공한 항목만 로컬 상태에서 제거한다.
- 기존 `documentApi`, `withMock`, localStorage 시드, Blob URL 생성·해제 로직은 이 Store에서 사용하지 않는다.

## 목록 화면

- 제목은 `자소서 및 포트폴리오`를 유지한다.
- 필터는 `전체 / 자소서 / 포트폴리오`를 유지한다.
- 카드는 자료 유형, 제목, 등록일, `보기`, `삭제`를 표시한다.
- 서버가 파일 크기를 제공하지 않으므로 크기 표시는 제거한다.
- 빈 목록은 기존 빈 상태를 유지한다.
- 목록 호출 실패 시 오류 메시지와 `다시 시도` 버튼을 표시한다.

## 새 자료 등록

`새 자료 등록`을 누르면 모달을 연다.

### 1단계: 자료 유형 선택

- `자소서`
- `포트폴리오`

### 2단계: 등록 정보

- 제목: 필수, 공백 제외 1~50자
- 파일: PDF만, 파일명 `.pdf` 및 MIME `application/pdf`
- 선택한 유형을 모달 상단에 표시한다.
- `이전`으로 유형 선택 단계에 돌아갈 수 있다.
- 등록 중에는 닫기·이전·등록 버튼을 비활성화한다.
- 성공하면 모달을 닫고 해당 유형 목록을 재조회한다.
- 실패하면 모달을 유지하고 서버 오류를 표시해 같은 파일로 다시 시도할 수 있게 한다.

## 상세 화면

- 복합 ID를 이용해 올바른 상세 API를 호출한다.
- 자소서는 서버의 `content`를 읽기 가능한 텍스트 영역에 표시한다.
- 포트폴리오는 서버의 `summary`를 요약 영역에 표시한다.
- `resumePath`, `portfolioPath`는 `s3://` 경로이므로 iframe·새 창 링크에 사용하지 않는다.
- PDF 미리보기와 다운로드 버튼은 제거한다.
- 삭제 성공 후 목록 화면으로 이동한다.
- 상세 조회가 404이면 자료를 찾을 수 없다는 상태와 목록 이동 버튼을 표시한다.

## 오류 처리

- 400·422: 제목 또는 PDF 유효성 오류로 표시하고 모달을 유지한다.
- 401: 공통 API 클라이언트의 인증 만료 처리를 따른다.
- 403: 권한 오류를 표시한다.
- 404: 상세 자료 없음 또는 삭제 대상 없음으로 처리한다.
- 5xx·네트워크 오류: 실제 오류를 표시하고 다시 시도할 수 있게 한다.
- 어떤 오류에서도 Mock 목록이나 가짜 등록 결과를 생성하지 않는다.

## 테스트 및 완료 조건

- 목록 조회가 `/resumes`, `/portfolios`를 각각 한 번 호출한다.
- 동일한 숫자 ID의 자소서와 포트폴리오가 동시에 유지된다.
- 목록이 `createdAt` 내림차순으로 병합된다.
- 자소서·포트폴리오 등록이 각각 올바른 URL과 `title`, `file` multipart 필드를 사용한다.
- 제목 공백, 51자 제목, PDF가 아닌 파일을 서버 호출 전에 차단한다.
- 등록 성공 후 해당 유형 목록이 다시 조회된다.
- 삭제가 복합 ID의 유형에 맞는 API를 호출한다.
- 상세 화면이 자소서 `content`와 포트폴리오 `summary`를 구분해 표시한다.
- 목록·등록·상세·삭제 오류에서 Mock 데이터가 나타나지 않는다.
- 전체 프런트 테스트와 프로덕션 빌드가 통과한다.
- `/mypage/documents`의 데스크톱·모바일 렌더링, 필터, 모달 단계 이동을 브라우저에서 확인한다.

## 제외 사항

- 발표 자료 목록 및 등록
- PDF 원본 미리보기와 다운로드
- 파일 크기와 원본 파일명 표시
- 제목 수정과 파일 교체
- Spring, FastAPI, DB 변경
