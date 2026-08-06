# AIVO Frontend

AIVO의 발표·면접 연습 웹 클라이언트입니다. Vue 3, Vite, Pinia, Vue Router로 구성된 단일 페이지 애플리케이션이며 모든 화면은 `src/views`의 Vue SFC로 구현되어 있습니다. 정적 HTML 프로토타입이나 `public/legacy` 런타임은 사용하지 않습니다.

## 실행

Node.js 20.19 이상을 권장합니다.

```bash
npm ci
npm run dev
```

기본 개발 주소는 `http://127.0.0.1:5173`입니다.

```bash
npm test
npm run build
npm run preview
```

## 환경 변수

`.env.example`을 `.env`로 복사한 뒤 환경에 맞게 수정합니다.

| 변수 | 기본값 | 용도 |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Spring Boot API 기본 경로 |
| `VITE_MEDIAPIPE_WASM_URL` | 코드의 CDN 기본값 | MediaPipe WASM 경로(선택) |
| `VITE_MEDIAPIPE_FACE_MODEL_URL` | 코드의 CDN 기본값 | 얼굴 모델 경로(선택) |
| `VITE_MEDIAPIPE_POSE_MODEL_URL` | 코드의 CDN 기본값 | 자세 모델 경로(선택) |

## 구조

```text
src/
├─ api/           # fetch client, 도메인 API, DTO normalizer, request payload
├─ assets/        # 이미지, 폰트, 디자인 토큰, 공통·화면별 CSS
├─ components/    # 재사용 UI 컴포넌트
├─ composables/   # 카메라·녹화·STT·분석·브라우저 수명주기 로직
├─ constants/     # 저장소 키 등 공유 계약
├─ layouts/       # Default, Immersive, MyPage 레이아웃
├─ mocks/         # 백엔드 미구현 구간의 도메인 fixture
├─ router/        # 도메인별 route module과 전역 guard
├─ services/      # MediaPipe 등 외부 분석 서비스
├─ stores/        # Pinia 도메인 상태와 API orchestration
├─ utils/         # 저장소·검증·PPTX/PDF 변환 유틸리티
└─ views/         # 라우트와 1:1로 대응하는 완성 화면
```

화면은 도메인 파일을 직접 import해 코드 분할 경계를 유지합니다. 공통 헤더·푸터는 `DefaultLayout`, 홈과 녹화 화면은 `ImmersiveLayout`, 마이페이지 하위 화면은 `MyPageLayout`이 담당합니다.

## 백엔드 연동 원칙

- endpoint는 `src/api/*Api.js`에서만 정의합니다.
- 서버 응답 필드 변환은 `src/api/normalizers`, 요청 DTO 조립은 `src/api/payloads`에 둡니다.
- Store는 화면 상태와 API 호출 순서를 관리하고 View는 Store 액션을 사용합니다.
- `withMock()`은 네트워크 실패, 미구현 endpoint, SPA fallback에만 fixture를 사용합니다. 인증·권한·검증 오류는 호출자에게 전달됩니다.
- Nginx는 `/api/*`를 Spring Boot로 먼저 전달하고, Vue 경로만 `index.html`로 fallback해야 합니다.

## 문서

- [프로젝트 컨텍스트](./PROJECT_CONTEXT.md)
- [프론트 폴더 구조](./docs/frontend-structure.md)
- [프론트 기능 명세](./docs/frontend-specification.md)
- [API 연동 명세](./docs/api-specification.md)
- [백엔드 연동·배포 가이드](./docs/backend-integration-guide.md)
