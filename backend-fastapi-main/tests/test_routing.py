from app.messaging.contracts import EventStatus, TaskType, WorkerType
from app.messaging.routing import create_routing_key


def test_audio_stt_requested_routing_key() -> None:
    assert (
        create_routing_key(
            WorkerType.AUDIO,
            TaskType.STT,
            EventStatus.REQUESTED,
        )
        == "analysis.request.audio"
    )


def test_llm_report_completed_routing_key() -> None:
    assert (
        create_routing_key(
            WorkerType.LLM,
            TaskType.REPORT_GENERATION,
            EventStatus.COMPLETED,
        )
        == "analysis.result"
    )
