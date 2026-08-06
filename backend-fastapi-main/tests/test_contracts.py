from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.messaging.contracts import (
    AiEvent,
    AudioAnalysisRequestPayload,
    EventStatus,
    SttRequestPayload,
    TaskType,
    WorkerType,
)


def valid_event_dict() -> dict[str, object]:
    event_id = str(uuid4())
    return {
        "eventId": event_id,
        "jobId": str(uuid4()),
        "correlationId": event_id,
        "workerType": "AUDIO",
        "taskType": "STT",
        "status": "REQUESTED",
        "schemaVersion": 1,
        "occurredAt": datetime.now(UTC).isoformat(),
        "payload": {
            "presentationId": 100,
            "audioUrl": "https://example.com/audio/test.webm",
            "language": "ko",
        },
    }


def test_valid_event_parsing() -> None:
    event = AiEvent.model_validate(valid_event_dict())

    assert event.workerType == WorkerType.AUDIO
    assert event.taskType == TaskType.STT
    assert event.status == EventStatus.REQUESTED
    assert event.payload["presentationId"] == 100


def test_missing_required_field_fails() -> None:
    data = valid_event_dict()
    del data["eventId"]

    with pytest.raises(ValidationError):
        AiEvent.model_validate(data)


def test_unknown_field_fails() -> None:
    data = valid_event_dict()
    data["unknown"] = "not-allowed"

    with pytest.raises(ValidationError):
        AiEvent.model_validate(data)


def test_invalid_enum_value_fails() -> None:
    data = valid_event_dict()
    data["workerType"] = "IMAGE"

    with pytest.raises(ValidationError):
        AiEvent.model_validate(data)


def test_payload_model_validation_failure() -> None:
    with pytest.raises(ValidationError):
        SttRequestPayload.model_validate(
            {
                "presentationId": 100,
                "language": "ko",
            }
        )


def test_audio_analysis_payload_validation() -> None:
    payload = AudioAnalysisRequestPayload.model_validate(
        {
            "interviewId": 10,
            "practiceId": 20,
            "sequence": 3,
            "audioUrl": "s3://aivo-audios/interviews/10/chunk-3.wav",
        }
    )

    assert payload.interviewId == 10
    assert payload.practiceId == 20
    assert payload.sequence == 3
