# backend-fastapi

FastAPI backend for AIVO AI model requests.

## Aivo AI Server

FastAPI HTTP 서버와 RabbitMQ 기반 AI Worker를 같은 코드베이스에서 별도 프로세스로 실행하는 프로젝트입니다.

## 설치

```bash
pip install -r requirements.txt
```

## 환경변수

Linux/macOS:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

주요 RabbitMQ 설정:

```env
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
RABBITMQ_EXCHANGE=analysis.exchange
RABBITMQ_AUDIO_QUEUE=analysis.audio.queue
RABBITMQ_LLM_QUEUE=analysis.llm.queue
RABBITMQ_BACKEND_RESULT_QUEUE=analysis.result.queue
RABBITMQ_AUDIO_RETRY_QUEUE=analysis.audio.retry.queue
RABBITMQ_LLM_RETRY_QUEUE=analysis.llm.retry.queue
RABBITMQ_RESULT_RETRY_QUEUE=analysis.result.retry.queue
RABBITMQ_DEAD_QUEUE=analysis.dead.queue
AUDIO_WORKER_PREFETCH=1
LLM_WORKER_PREFETCH=2
RABBITMQ_PUBLISH_TIMEOUT=10
```

RunPod의 영구 디스크를 사용하는 faster-whisper 모델 캐시 설정:

```env
WHISPER_MODEL=large-v3-turbo
WHISPER_MODEL_ROOT=/workspace/models/faster-whisper
WORKSPACE_ROOT=/workspace
```

## 실행

FastAPI HTTP 서버:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Audio Worker:

```bash
python -m app.workers.audio_worker
```

LLM Worker:

```bash
python -m app.workers.llm_worker
```

기존 헬스체크:

```text
GET /health
```

STT 업로드 웹 페이지:

```text
GET /upload
```

## RabbitMQ 실행 예시

```bash
docker run --rm --name aivo-rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:3-management
```

RabbitMQ 관리 페이지:

```text
http://localhost:15672
```

이미 `aivo-rabbitmq` 컨테이너가 떠 있으면 `docker compose up`에서 컨테이너 이름 충돌이 날 수 있습니다. 이 경우 기존 컨테이너를 정리한 뒤 다시 실행합니다.

```bash
docker stop aivo-rabbitmq
docker rm aivo-rabbitmq
docker compose up --build
```

Windows PowerShell도 동일합니다.

## 테스트 흐름

```text
1. RabbitMQ 실행
2. Audio Worker 실행
3. LLM Worker 실행
4. Result Consumer 실행
5. Audio 또는 LLM 테스트 요청 발행
6. 결과 이벤트 확인
```

Result Queue 테스트 Consumer:

```bash
python -m scripts.consume_result_test
```

Audio 테스트 요청 발행:

```bash
python -m scripts.publish_audio_test
```

LLM 테스트 요청 발행:

```bash
python -m scripts.publish_llm_test
```

## RabbitMQ 토폴로지

Exchange:

```text
analysis.exchange
type: topic
durable: true
```

Queues:

```text
analysis.audio.queue
binding: analysis.request.audio

analysis.llm.queue
binding: analysis.request.llm

analysis.result.queue
binding: analysis.result

analysis.audio.retry.queue
binding: analysis.retry.audio

analysis.llm.retry.queue
binding: analysis.retry.llm

analysis.result.retry.queue
binding: analysis.retry.result

analysis.dead.queue
binding: analysis.dead
```

Routing key 규칙:

```text
Audio 요청: analysis.request.audio
LLM 요청: analysis.request.llm
처리 결과: analysis.result
```

예:

```text
analysis.request.audio
analysis.request.llm
analysis.result
```

## 메시지 처리 보장

- RabbitMQ Consumer는 수동 ACK를 사용합니다.
- 결과 이벤트 발행이 성공한 뒤에만 원본 요청 메시지를 ACK합니다.
- 결과 발행 실패 시 원본 요청 메시지는 `nack(requeue=True)` 처리됩니다.
- 이 구조는 at-least-once 전달 가능성이 있습니다.
- 장애/재시도 상황에서 결과 이벤트가 중복 발행될 수 있습니다.
- Spring Backend는 `jobId + taskType` 기준으로 멱등 처리해야 합니다.
- JSON 파싱 실패 또는 복구 불가능한 Event Envelope는 `reject(requeue=False)` 처리합니다.
- AI 처리 실패는 `FAILED` 결과 이벤트로 변환한 뒤 결과 발행 성공 시 ACK합니다.

## 단위 테스트

외부 RabbitMQ 없이 실행:

```bash
pytest
```

문법/임포트 확인:

```bash
python -m compileall app scripts
```

## Dummy 구현 상태

아직 실제 AI 처리는 연결하지 않았습니다.

- `AudioTaskService.load_models()`에 faster-whisper 및 음성 분석 모델 로딩 예정
- `AudioTaskService.handle_stt()`는 현재 Dummy STT 결과 반환
- `AudioTaskService.handle_voice_analysis()`는 현재 Dummy 음성 분석 결과 반환
- `AudioTaskService.handle_pronunciation_analysis()`는 현재 Dummy 발음 분석 결과 반환
- `LlmTaskService`의 질문/피드백/리포트 생성은 현재 Dummy 결과 반환
