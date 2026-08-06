from app.messaging.constants import AUDIO_ROUTING_KEY, LLM_ROUTING_KEY, RESULT_ROUTING_KEY
from app.messaging.contracts import EventStatus, TaskType, WorkerType

TASK_ROUTING_SEGMENTS: dict[TaskType, str] = {
    TaskType.AUDIO_ANALYSIS: "audio-analysis",
    TaskType.STT: "stt",
    TaskType.VOICE_ANALYSIS: "voice-analysis",
    TaskType.PRONUNCIATION_ANALYSIS: "pronunciation-analysis",
    TaskType.AUDIENCE_QUESTION_GENERATION: "audience-question",
    TaskType.FEEDBACK_GENERATION: "feedback",
    TaskType.REPORT_GENERATION: "report",
}


def create_routing_key(
    worker_type: WorkerType,
    task_type: TaskType,
    status: EventStatus,
) -> str:
    if task_type not in TASK_ROUTING_SEGMENTS:
        raise ValueError(f"Unsupported task type for routing: {task_type}")

    if status == EventStatus.REQUESTED:
        if worker_type == WorkerType.AUDIO:
            return AUDIO_ROUTING_KEY
        if worker_type == WorkerType.LLM:
            return LLM_ROUTING_KEY
        raise ValueError(f"Unsupported worker type for routing: {worker_type}")

    if status in {EventStatus.COMPLETED, EventStatus.FAILED}:
        return RESULT_ROUTING_KEY

    raise ValueError(f"Unsupported event status for routing: {status}")
