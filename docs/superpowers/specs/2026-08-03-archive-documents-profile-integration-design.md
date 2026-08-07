# 내 기록·지원 자료·프로필 API 연결 설계

## 목표

현재 Spring API로 지원되는 내 기록 발표 목록, 자소서·포트폴리오, 사용자 프로필 기능을 실제 API에 연결한다. 지원되지 않는 면접 연습 목록과 면접 리포트 상세는 변경하지 않는다.

## 전역 제약

- 프런트엔드만 수정하고 `backend-spring-develop`, `backend-fastapi-main`은 변경하지 않는다.
- 면접 리포트 상세 화면과 면접 녹화·분석 코드는 수정하지 않는다.
- 서버에 없는 값은 가짜 점수나 가짜 연습 기록으로 생성하지 않는다.
- 기존 학습 추이 관련 미커밋 변경은 보존한다.
- 기존 Vue 3, Pinia, Vue Router, API client 구조를 유지하고 새로운 상태 관리 패턴을 도입하지 않는다.

## 1. 내 기록 발표 폴더와 연습 목록

### API

- `GET /api/v1/practice-folders?type=presentation&keyword={keyword}`
- `GET /api/v1/practice-folders/{folderId}?type=presentation`
- `GET /api/v1/practice-folders/{folderId}/presentation-practices`

### 동작

- `/archive`의 발표 탭은 기존 `/reports` 대신 폴더 목록 API를 사용한다.
- 폴더 이동 키는 제목이 아니라 `folderId`를 사용한다.
- 폴더 상세 화면은 폴더 상세와 발표 연습 목록을 각각 조회한다.
- 발표 연습 항목은 `practiceId`, `presentationId`, `title`, `description`, `durationSec`, `createdAt`을 표시한다.
- 발표 리포트 상세 링크에는 `presentationId`를 전달한다.
- 발표 연습 목록 응답에 점수가 없으므로 최고 점수, 최근 점수, 점수 그래프를 임의로 생성하지 않는다. 점수 영역에는 데이터 부족 상태를 표시한다.
- 한 건의 실제 연습을 일곱 건으로 늘리는 기존 데모 로직과 파생 가짜 세부 점수를 제거한다.

### 제한

- 현재 Spring의 폴더 `type` 처리는 실제 관계를 필터링하지 않으므로 전체·면접 탭의 정확한 분리는 보장할 수 없다.
- 면접 폴더 내부 연습 목록 API가 없으므로 면접 목록과 면접 리포트 상세 연결은 이번 범위에서 제외한다.

## 2. 자소서·포트폴리오

### API

- `GET /api/v1/resumes`, `GET /api/v1/resumes/{resumeId}`
- `POST /api/v1/resumes/upload`, `DELETE /api/v1/resumes/{resumeId}`
- `GET /api/v1/portfolios`, `GET /api/v1/portfolios/{portfolioId}`
- `POST /api/v1/portfolios/upload`, `DELETE /api/v1/portfolios/{portfolioId}`

### 동작

- 등록 유형 선택에 따라 자소서와 포트폴리오 API를 분리 호출한다.
- 업로드는 multipart `title`, `file` 필드를 사용하고 PDF만 허용한다.
- 자소서 목록 조회가 실패해도 포트폴리오 결과는 표시하고, 포트폴리오 조회가 실패해도 자소서 결과는 표시한다.
- 상세 화면은 합성 ID `resume:{id}`, `portfolio:{id}`를 서버 ID로 복원해 해당 상세 API를 호출한다.
- 자소서는 추출 본문 `content`, 포트폴리오는 요약 `summary`를 표시한다.
- 서버 오류를 로컬 Mock 자료로 대체하지 않는다.

## 3. 프로필 조회·닉네임·이미지 변경

### API 계약

`PATCH /api/v1/users/me`에 다음 multipart를 전송한다.

- `request`: `application/json` Blob

```json
{
  "nickname": "변경할 닉네임",
  "removeProfileImage": false
}
```

- `profileImage`: 새 이미지를 선택한 경우에만 포함

기존 이미지를 삭제할 때는 `profileImage`를 보내지 않고 `removeProfileImage: true`를 보낸다.

### 이미지 UI

- 새 영역을 추가하지 않고 기존 원형 `이미지 변경` 영역을 실제 파일 선택 컨트롤로 전환한다.
- 원형 영역을 클릭하거나 키보드로 실행하면 숨겨진 파일 input을 연다.
- 허용 형식은 JPEG, PNG, WebP이며 최대 크기는 5MB다.
- 파일 선택 즉시 로컬 미리보기를 표시한다.
- 서버의 `profileImageUrl`이 있으면 조회 화면과 수정 화면에 실제 이미지를 표시한다.
- 이미지가 없거나 삭제를 선택하면 닉네임 첫 글자 이니셜을 표시한다.
- 기존 이미지가 있을 때 `기본 이미지로 되돌리기` 동작을 제공한다.
- 취소 시 선택 파일, 삭제 예약, 미리보기 URL을 모두 폐기하고 서버 값으로 복원한다.
- 저장 성공 후 응답의 `nickname`, `profileImageUrl`, `createdAt`을 Pinia와 사용자 캐시에 반영한다.
- 중복 닉네임, 잘못된 이미지, 인증 오류를 Mock 성공으로 숨기지 않는다.

### 제거할 Mock UI

- 조회 화면의 `Google 계정 연동됨` 카드와 이메일 반복 표시를 제거한다.
- 수정 화면의 Google 연동 배지 블록을 제거한다.
- 프로필 이미지 변경처럼 보이지만 동작하지 않는 장식 전용 overlay를 실제 버튼 상태로 교체한다.

## 4. 오류 처리

- 발표 폴더와 연습 목록은 각각 로딩·오류·빈 상태를 구분한다.
- 점수가 없는 응답은 0점으로 정규화하지 않고 값 없음으로 유지한다.
- 문서 목록은 자소서·포트폴리오의 부분 성공 결과를 보존한다.
- 400·401·403·409·415·422 프로필 오류는 사용자에게 표시하며 성공 상태로 전환하지 않는다.
- 이미지 검증 실패 시 API를 호출하지 않고 파일 형식 또는 5MB 제한을 안내한다.

## 5. 테스트와 완료 조건

- 발표 폴더 목록, 폴더 상세, 발표 연습 목록의 URL과 응답 정규화를 검증한다.
- 내 기록 발표 화면이 `/reports`를 호출하지 않는지 검증한다.
- 한 건의 연습을 가짜 여러 건으로 생성하지 않는지 검증한다.
- 문서 업로드 FormData의 `title`, `file`과 자소서·포트폴리오 부분 실패를 검증한다.
- 프로필 FormData의 `request`, 선택적 `profileImage`, `removeProfileImage` 값을 검증한다.
- 이미지 형식·크기 검증, 미리보기, 취소, 삭제, 성공 응답 반영을 화면 테스트한다.
- Google 연동 문구와 블록이 렌더링되지 않는지 검증한다.
- 면접 리포트 상세 운영 파일이 변경되지 않았는지 기준 커밋과 비교한다.
- 전체 Vitest, 프로덕션 빌드와 실제 브라우저 주요 화면을 검증한다.

## 비범위

- 면접 폴더 내부 연습 목록 API 구현
- 면접 리포트 상세 조회 수정
- Spring·FastAPI·DB 수정
- OAuth 또는 실제 Google 계정 연동
- 점수 목록 응답을 얻기 위한 리포트 API N+1 호출
