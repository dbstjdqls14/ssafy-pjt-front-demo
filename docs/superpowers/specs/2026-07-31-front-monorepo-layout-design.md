# front 브랜치 3개 프로젝트 디렉터리 재구성 설계

## 목표

GitLab `front` 브랜치의 루트를 다음 세 프로젝트 디렉터리로 구성한다.

```text
backend-fastapi-main/
backend-spring-develop/
frontend-vue-main/
```

- `.idea/`는 포함하지 않는다.
- `backend-fastapi-main/`과 `backend-spring-develop/`은 현재 통합된 `origin/backend` 최신 내용을 유지한다.
- 현재 `front` 루트에 있는 최신 Vue 프런트 전체를 `frontend-vue-main/` 아래로 이동한다.

## 접근법 비교

### 1. 현재 프런트 추적 파일을 `git mv`로 이동 — 채택

- 현재 검증된 프런트 내용을 그대로 보존한다.
- Git이 파일 이동을 rename으로 추적할 수 있다.
- `origin/backend/frontend-vue-main`의 오래된 파일이 섞이지 않는다.

### 2. `origin/backend/frontend-vue-main`을 가져온 뒤 현재 프런트를 덮어쓰기

- backend 브랜치와 처음부터 비슷한 형태가 된다.
- 현재 프런트에서 삭제된 과거 파일이 남을 위험이 있어 채택하지 않는다.

### 3. 별도 저장소나 Git subtree로 결합

- 각 프로젝트 이력을 독립적으로 유지할 수 있다.
- 현재 단일 GitLab 저장소와 배포 브랜치 운영에는 복잡성이 불필요하게 커져 채택하지 않는다.

## 이동 범위

다음 현재 루트 항목을 `frontend-vue-main/`으로 이동한다.

```text
.env.example
.gitignore
AGENTS.md
PROJECT_CONTEXT.md
README.md
docs/
index.html
package-lock.json
package.json
public/
src/
tests/
vite.config.js
```

다음 항목은 루트에 유지한다.

```text
backend-fastapi-main/
backend-spring-develop/
```

로컬 검증용 비추적 항목인 `.codex-runtime/`, `node_modules/`, `dist/`는 커밋하거나 푸시하지 않는다.

## 검증

1. Git 트리의 루트 디렉터리가 세 프로젝트 디렉터리인지 확인한다.
2. `frontend-vue-main/`에서 Vitest 전체 테스트와 Vite 프로덕션 빌드를 실행한다.
3. `backend-fastapi-main/`에서 pytest를 실행한다.
4. Spring은 Java 25 런타임이 있으면 Gradle 테스트를 실행하고, 없으면 미검증 사유를 명시한다.
5. 푸시 직전 최신 `origin/front`가 로컬 HEAD의 조상인지 확인하고 비강제 fast-forward로 푸시한다.
6. 원격 `front` SHA와 로컬 HEAD SHA가 같은지 확인한다.

## 완료 조건

- 원격 `front`에서 `.idea/`가 보이지 않는다.
- 최신 프런트가 `frontend-vue-main/` 아래에 존재한다.
- 두 백엔드 폴더의 내용이 구조 변경 전과 동일하다.
- 추적 중인 루트 프로젝트 디렉터리는 세 개뿐이다.
