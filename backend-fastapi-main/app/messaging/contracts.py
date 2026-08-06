import json
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class WorkerType(StrEnum):
    AUDIO = "AUDIO"
    LLM = "LLM"


class EventStatus(StrEnum):
    REQUESTED = "REQUESTED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TaskType(StrEnum):
    AUDIO_ANALYSIS = "AUDIO_ANALYSIS"
    STT = "STT"
    VOICE_ANALYSIS = "VOICE_ANALYSIS"
    PRONUNCIATION_ANALYSIS = "PRONUNCIATION_ANALYSIS"
    AUDIENCE_QUESTION_GENERATION = "AUDIENCE_QUESTION_GENERATION"
    FEEDBACK_GENERATION = "FEEDBACK_GENERATION"
    REPORT_GENERATION = "REPORT_GENERATION"


class ErrorCode(StrEnum):
    INVALID_EVENT = "INVALID_EVENT"
    INVALID_EVENT_STATUS = "INVALID_EVENT_STATUS"
    INVALID_WORKER_TYPE = "INVALID_WORKER_TYPE"
    INVALID_PAYLOAD = "INVALID_PAYLOAD"
    UNSUPPORTED_TASK = "UNSUPPORTED_TASK"
    AI_PROCESSING_FAILED = "AI_PROCESSING_FAILED"


class AiEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    eventId: UUID
    jobId: UUID
    correlationId: UUID
    workerType: WorkerType
    taskType: TaskType
    status: EventStatus
    schemaVersion: int = Field(default=1, ge=1)
    occurredAt: datetime
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("occurredAt")
    @classmethod
    def occurred_at_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurredAt must be timezone-aware")
        return value.astimezone(UTC)


class SttRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    presentationId: int
    audioUrl: str
    language: str = "ko"


class AudioAnalysisRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    interviewId: int
    practiceId: int | None = None
    sequence: int | None = Field(default=None, ge=0)
    audioUrl: str | None = None
    language: str = "ko"


class VoiceAnalysisRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    presentationId: int
    audioUrl: str


class PronunciationAnalysisRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    presentationId: int
    audioUrl: str
    language: str = "ko"


class AudienceQuestionRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    presentationId: int
    transcriptUrl: str
    slideContentUrl: str
    questionCount: int = Field(gt=0)


class FeedbackRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    presentationId: int
    transcriptUrl: str
    voiceAnalysisUrl: str
    visualAnalysisUrl: str


class ReportRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    presentationId: int
    analysisResultUrls: list[str]
    includeSummary: bool = True


def utc_now() -> datetime:
    return datetime.now(UTC)


def parse_event_bytes(body: bytes) -> AiEvent:
    raw = json.loads(body.decode("utf-8"))
    return AiEvent.model_validate(raw)


def create_completed_event(request_event: AiEvent, payload: dict[str, Any]) -> AiEvent:
    return AiEvent(
        eventId=uuid4(),
        jobId=request_event.jobId,
        correlationId=request_event.eventId,
        workerType=request_event.workerType,
        taskType=request_event.taskType,
        status=EventStatus.COMPLETED,
        schemaVersion=request_event.schemaVersion,
        occurredAt=utc_now(),
        payload=payload,
    )


def create_failed_event(
    request_event: AiEvent,
    error_code: ErrorCode,
    error_message: str,
    retryable: bool = False,
) -> AiEvent:
    return AiEvent(
        eventId=uuid4(),
        jobId=request_event.jobId,
        correlationId=request_event.eventId,
        workerType=request_event.workerType,
        taskType=request_event.taskType,
        status=EventStatus.FAILED,
        schemaVersion=request_event.schemaVersion,
        occurredAt=utc_now(),
        payload={
            "errorCode": error_code.value,
            "errorMessage": error_message,
            "retryable": retryable,
        },
    )


def validation_error_message(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in issue['loc'])}: {issue['msg']}"
        for issue in error.errors()
    )
