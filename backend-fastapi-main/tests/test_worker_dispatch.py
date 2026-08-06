import asyncio
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.messaging.contracts import AiEvent, ErrorCode, EventStatus, TaskType, WorkerType
from app.workers.base import RabbitWorker


def make_event(
    worker_type: WorkerType = WorkerType.AUDIO,
    task_type: TaskType = TaskType.STT,
    status: EventStatus = EventStatus.REQUESTED,
    payload: dict[str, Any] | None = None,
) -> AiEvent:
    event_id = uuid4()
    return AiEvent(
        eventId=event_id,
        jobId=uuid4(),
        correlationId=event_id,
        workerType=worker_type,
        taskType=task_type,
        status=status,
        schemaVersion=1,
        occurredAt=datetime.now(UTC),
        payload=payload or {"presentationId": 100},
    )


def test_stt_is_dispatched_to_audio_handler() -> None:
    called: dict[str, Any] = {}

    async def handler(payload: dict[str, Any]) -> dict[str, Any]:
        called["payload"] = payload
        return {"presentationId": payload["presentationId"], "ok": True}

    worker = RabbitWorker(
        worker_name="test-audio",
        worker_type=WorkerType.AUDIO,
        queue_name="queue",
        binding_key="analysis.request.audio",
        prefetch_count=1,
        handlers={TaskType.STT: handler},
    )

    result = asyncio.run(worker.handle_event(make_event()))

    assert called["payload"]["presentationId"] == 100
    assert result.status == EventStatus.COMPLETED
    assert result.payload["ok"] is True


def test_audio_analysis_is_dispatched_to_audio_handler() -> None:
    async def handler(payload: dict[str, Any]) -> dict[str, Any]:
        return {"interviewId": payload["interviewId"], "fillerCount": 2}

    worker = RabbitWorker(
        worker_name="test-audio",
        worker_type=WorkerType.AUDIO,
        queue_name="queue",
        binding_key="analysis.request.audio",
        prefetch_count=1,
        handlers={TaskType.AUDIO_ANALYSIS: handler},
    )

    result = asyncio.run(
        worker.handle_event(
            make_event(
                task_type=TaskType.AUDIO_ANALYSIS,
                payload={"interviewId": 10},
            )
        )
    )

    assert result.status == EventStatus.COMPLETED
    assert result.payload["fillerCount"] == 2


def test_llm_task_is_dispatched_to_llm_handler() -> None:
    async def handler(payload: dict[str, Any]) -> dict[str, Any]:
        return {"presentationId": payload["presentationId"], "questions": []}

    worker = RabbitWorker(
        worker_name="test-llm",
        worker_type=WorkerType.LLM,
        queue_name="queue",
        binding_key="analysis.request.llm",
        prefetch_count=2,
        handlers={TaskType.AUDIENCE_QUESTION_GENERATION: handler},
    )

    result = asyncio.run(
        worker.handle_event(
            make_event(
                worker_type=WorkerType.LLM,
                task_type=TaskType.AUDIENCE_QUESTION_GENERATION,
            )
        )
    )

    assert result.status == EventStatus.COMPLETED
    assert "questions" in result.payload


def test_unsupported_task_returns_failed_event() -> None:
    worker = RabbitWorker(
        worker_name="test-audio",
        worker_type=WorkerType.AUDIO,
        queue_name="queue",
        binding_key="analysis.request.audio",
        prefetch_count=1,
        handlers={},
    )

    result = asyncio.run(worker.handle_event(make_event()))

    assert result.status == EventStatus.FAILED
    assert result.payload["errorCode"] == ErrorCode.UNSUPPORTED_TASK.value


def test_wrong_worker_type_returns_failed_event() -> None:
    worker = RabbitWorker(
        worker_name="test-audio",
        worker_type=WorkerType.AUDIO,
        queue_name="queue",
        binding_key="analysis.request.audio",
        prefetch_count=1,
        handlers={},
    )

    result = asyncio.run(
        worker.handle_event(
            make_event(
                worker_type=WorkerType.LLM,
                task_type=TaskType.FEEDBACK_GENERATION,
            )
        )
    )

    assert result.status == EventStatus.FAILED
    assert result.payload["errorCode"] == ErrorCode.INVALID_WORKER_TYPE.value


def test_handler_failure_returns_failed_event() -> None:
    async def handler(_: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("boom")

    worker = RabbitWorker(
        worker_name="test-audio",
        worker_type=WorkerType.AUDIO,
        queue_name="queue",
        binding_key="analysis.request.audio",
        prefetch_count=1,
        handlers={TaskType.STT: handler},
    )

    result = asyncio.run(worker.handle_event(make_event()))

    assert result.status == EventStatus.FAILED
    assert result.payload["errorCode"] == ErrorCode.AI_PROCESSING_FAILED.value
