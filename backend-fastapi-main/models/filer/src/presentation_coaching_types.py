"""Immutable records and UTF-8 persistence for presentation-coaching runs."""

from dataclasses import dataclass
from enum import StrEnum
import json
from pathlib import Path
from types import MappingProxyType
from typing import Mapping


class EventKind(StrEnum):
    """Types of speech events that can receive presentation coaching."""

    FILLER = "filler"
    REPETITION = "repetition"
    ELONGATION = "elongation"
    PAUSE = "pause"
    LONG_PAUSE = "long_pause"
    VERY_LONG_PAUSE = "very_long_pause"
    SPEECH_RATE = "speech_rate_change"


class ReviewerVerdict(StrEnum):
    """Human reviewer decisions stored for a detected coaching event."""

    UNREVIEWED = "unreviewed"
    CORRECT = "correct"
    INCORRECT = "incorrect"
    NOT_A_COACHING_PROBLEM = "not_a_coaching_problem"


@dataclass(frozen=True, slots=True)
class EmptySuccessfulModelRunError(ValueError):
    """Raised when a no-error model run has no transcription or coaching output."""

    model_id: str

    def __str__(self) -> str:
        return f"Model run {self.model_id!r} needs output or a non-empty error."


@dataclass(frozen=True, slots=True)
class WordTiming:
    """A word-level ASR timestamp in seconds."""

    text: str
    start_seconds: float
    end_seconds: float


@dataclass(frozen=True, slots=True)
class CoachingEvent:
    """An evidence-backed event shown to the presentation reviewer."""

    event_id: str
    kind: EventKind
    start_seconds: float
    end_seconds: float
    text: str
    evidence: Mapping[str, str | float]
    coaching_message: str
    confidence: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "evidence", MappingProxyType(dict(self.evidence)))


@dataclass(frozen=True, slots=True)
class RunMetrics:
    """Timing and resource measurements for a single model execution."""

    model_load_seconds: float
    transcription_seconds: float
    analysis_seconds: float
    realtime_factor: float
    max_vram_mib: float
    gpu_utilization_percent: float
    process_ram_mib: float


@dataclass(frozen=True, slots=True)
class ModelRun:
    """One candidate model's transcription, coaching events, and resource use."""

    model_id: str
    compute_type: str
    gpu_name: str
    words: tuple[WordTiming, ...]
    events: tuple[CoachingEvent, ...]
    metrics: RunMetrics
    error: str | None = None
    transcription_profile: str | None = None
    transcription_variant: str | None = None
    crisper_prompt_mode: str | None = None
    crisper_runtime_backend: str | None = None
    crisper_hallucination_mitigation: bool | None = None

    def __post_init__(self) -> None:
        if not self.error and not self.words and not self.events:
            raise EmptySuccessfulModelRunError(self.model_id)


def write_review_labels(path: Path, events: tuple[CoachingEvent, ...]) -> None:
    """Initialize every event at *path* as an unreviewed UTF-8 JSON label."""
    labels = {event.event_id: ReviewerVerdict.UNREVIEWED.value for event in events}
    path.write_text(json.dumps(labels, ensure_ascii=False, indent=2), encoding="utf-8")


def read_review_labels(path: Path) -> dict[str, ReviewerVerdict]:
    """Read reviewer verdicts from the JSON label file at *path*."""
    raw_labels = json.loads(path.read_text(encoding="utf-8"))
    return {
        event_id: ReviewerVerdict(verdict)
        for event_id, verdict in raw_labels.items()
    }
