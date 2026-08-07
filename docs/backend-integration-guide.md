# AIVO 프론트엔드 ↔ 백엔드 통합 가이드

백엔드 팀이 프론트 구조와 배포 라우팅을 빠르게 파악하기 위한 인수인계 자료입니다. 프론트 내부 구조는 `docs/frontend-structure.md`를 함께 참고하세요.

endpoint별 요청·응답과 구현 체크리스트는 `docs/api-specification.md`를 단일 기준으로 사용합니다.

## 1. 현재 프론트 구조 요약

Vue 3 + Vite **SPA**. 모든 화면은 `src/views`의 순수 Vue SFC이고, 상태는 Pinia, 라우팅은 Vue Router(`createWebHistory`)입니다. 과거의 정적 HTML 프로토타입(`public/legacy`)과 런타임 로더(`useLegacyView`)는 제거됐습니다 — 이제 배포 산출물은 **표준 Vite 빌드**(`dist/index.html` + `dist/assets/*`)뿐입니다.

```text
dist/
├─ index.html        # SPA 진입점 (모든 Vue route의 fallback 대상)
└─ assets/*          # 번들된 JS/CSS/폰트/이미지 (해시 파일명)
```

빌드: `npm run build` → `dist/`. API 기본 경로는 `/api/v1`이며 `.env`의 `VITE_API_BASE_URL`로 재정의할 수 있습니다.

## 2. 배포 라우팅 (Nginx 앞단 기준)

```text
Users -> Nginx :80/443
           -> Spring Boot 127.0.0.1:8080   (/api)
           -> Grafana     127.0.0.1:3000   (/grafana/)
         -> SPA index.html                 (그 외 전부)
Spring Boot -> PostgreSQL (Tailscale private)
```

| 경로 | 처리 | 이유 |
|---|---|---|
| `/api/*` | Spring Boot proxy | 프론트 API 네임스페이스 (fallback보다 먼저 매칭) |
| `/grafana/*` | Grafana proxy | 관측 경로 (fallback보다 먼저 매칭) |
| `/assets/*` | 정적 서빙 | Vite 빌드 산출물 |
| `/` 및 모든 Vue route | `index.html` fallback | 직접 접근/새로고침 시 Vue Router가 처리 |

```nginx
location /api/ { proxy_pass http://127.0.0.1:8080; }
location /grafana/ { proxy_pass http://127.0.0.1:3000/; }
location /assets/ { try_files $uri =404; }
location / { try_files $uri $uri/ /index.html; }
```

> 더 이상 `/legacy/` 정적 경로는 필요 없습니다.

## 3. 프론트 라우트 목록

도메인별 정의는 `src/router/modules/*Routes.js`, 전체 조합 진입점은 `src/router/routes.js`입니다. SPA fallback만 되면 모든 경로가 동작합니다.

| 영역 | 경로 |
|---|---|
| common | `/`, `/faq` |
| auth | `/login`, `/register`, `/find-account` |
| practice | `/practice`, `/practice/folders` |
| presentation | `/presentation/{setup,slides,check,ready,record,qna,analyzing,report}` |
| interview | `/interview/{setup,style,questions,check,ready,record,analyzing,report,report/detail}` |
| archive | `/archive`, `/archive/folders/:id?`, `/archive/detail/:id?` |
| mypage | `/mypage`, `/mypage/{documents,documents/:id,security,trend}` (인증 필요) |

## 4. 현재 mock 저장소와 백엔드 전환 포인트

데이터는 각 Pinia store가 관리하며, API 호출은 `src/api/withMock.js`로 감쌉니다. 백엔드 미준비 시 로컬 목/브라우저 저장소로 폴백하고, 실제 endpoint가 응답하면 그 값이 자동 우선됩니다.

브라우저 저장 키는 `src/constants/storageKeys.js`에 모여 있습니다. 저장 데이터 스키마나 키 버전을 변경할 때는 해당 파일과 관련 store의 마이그레이션 로직을 함께 수정합니다.
정적 fallback 데이터는 `src/mocks`에 도메인별로 분리되어 있습니다. 백엔드 연동 시에는 `src/api`의 계약과 Store 정규화만 확인하면 되고 화면 컴포넌트나 fixture를 수정할 필요가 없습니다.

`withMock()`은 네트워크 연결 실패, 미구현 endpoint(`404`, `501`), 일시적인 게이트웨이/서비스 장애(`502`~`504`), 또는 API 대신 `index.html`이 반환된 경우에만 fixture를 사용합니다. `401`, `403`, `409`, `422` 같은 인증·권한·업무 검증 오류는 목 데이터로 숨기지 않고 화면까지 전달되므로 백엔드 오류 계약을 그대로 점검할 수 있습니다.

| 도메인 | 현재 목 방식 | 백엔드 전환 대상 API |
|---|---|---|
| 인증/사용자 | `authStore` + `localStorage('aivo.user')` | `POST /auth/login·logout`, `GET /users/me` |
| 연습 폴더 | `practiceStore` (선택 상태) | `GET/POST/PATCH/DELETE /practice-folders` |
| 발표 세션 | `presentationStore` + `sessionStorage('aivo.presentation-flow')` | `/presentation-sessions/*` (슬라이드 업로드·리포트 포함) |
| 면접 세션 | `interviewStore` + `sessionStorage('aivo.interview-flow-v2')` | `/interview-sessions/*` |
| 연습 기록 | `archiveStore` + `localStorage('aivo.session-history.v2')` (시드) | 기록/리포트 조회 API |
| 녹화/슬라이드 | 브라우저 media API + 파일명·미리보기 목 | 녹화 업로드, PPT/PDF slide extraction, 분석 요청/결과 |

예상 API 그룹 (기본 base `/api/v1`):

```text
/api/v1/auth/*           /api/v1/users/me
/api/v1/practice-folders /api/v1/presentation-sessions  /api/v1/interview-sessions
/api/v1/uploads/slides   /api/v1/recordings             /api/v1/reports
```

백엔드는 `src/api/*Api.js`의 경로·응답 형태만 맞추면 되고, 프론트 뷰/스토어는 그대로 둡니다. `{ data: payload }` envelope과 도메인별 목록 키(`items`, `content`, `folders`, `questions` 등)는 `src/api/response.js`가 Store 진입 전에 공통 해석합니다. 선택 쿼리는 `src/api/query.js`, 파일·녹화 multipart payload는 `src/api/formData.js`가 담당합니다. 인증 사용자·이메일 중복 확인·기록·연습 폴더·지원 문서·면접 질문·발표 슬라이드 DTO의 필드 별칭은 `src/api/normalizers/`에서 프론트 모델로 변환하고, 발표·면접 세션 생성/수정 요청의 필드 매핑은 `src/api/payloads/`에서 관리합니다.

## 5. 배포 필수 조건

- **Secure context**: 발표/면접 녹화는 `getUserMedia`·`MediaRecorder`·음성 인식을 사용합니다. `localhost` 또는 **HTTPS**에서만 안정 동작하므로, 테스트 도메인에 HTTPS(또는 Tailscale HTTPS/Nginx TLS)를 적용하세요. `http://...:80` 접근 시 브라우저가 카메라/마이크를 차단할 수 있습니다.
- **SPA fallback**: `createWebHistory` 사용 → `/presentation/setup`, `/archive/detail/123` 등 직접 접근/새로고침 시 백엔드가 404 대신 `index.html`을 반환해야 합니다.
- **같은 origin 권장**: 프론트와 API를 같은 origin에서 `/api`로 묶어 CORS를 피하세요. 인증 쿠키는 `HttpOnly`·`SameSite`·`Secure`(HTTPS 기준).
- **업로드 한도**: 대용량 녹화/슬라이드 업로드 제한을 Nginx와 Spring Boot 양쪽에서 동일하게 설정.

## 6. 백엔드 팀 전달 체크리스트

- [ ] `dist/index.html` + `/assets/*` 정적 서빙 확인
- [ ] `/api/*` → Spring Boot 라우팅, 프론트 fallback보다 먼저 매칭
- [ ] `/grafana/*` → Grafana 라우팅, fallback보다 먼저 매칭
- [ ] `/presentation/setup`, `/archive/detail/123` 등 직접 접근 시 `index.html` 반환
- [ ] 녹화 테스트 URL이 HTTPS인지 확인
- [ ] `src/api/*Api.js` 경로/응답 계약 확정 및 공유
- [ ] 인증 쿠키 정책(`HttpOnly`/`SameSite`/`Secure`) 및 업로드 한도 정렬
