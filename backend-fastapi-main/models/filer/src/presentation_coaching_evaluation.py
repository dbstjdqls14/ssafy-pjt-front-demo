"""Reviewer-aware comparison records for presentation-coaching benchmarks."""

from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Iterable, Mapping, TypedDict

import polars as pl

from presentation_coaching_models import (
    BenchmarkedRun,
    CandidateAvailability,
    CandidateSpec,
)
from presentation_coaching_types import CoachingEvent, ReviewerVerdict


class BenchmarkRunRecord(TypedDict):
    audio_file: str
    model_id: str
    compute_type: str
    gpu_name: str
    transcription_profile: str | None
    transcription_variant: str | None
    crisper_prompt_mode: str | None
    words: list[dict[str, str | float]]
    events: list[dict[str, object]]
    metrics: dict[str, float]
    total_seconds: float
    resources: dict[str, float]
    error: str | None


class BenchmarkReport(TypedDict):
    language: str
    audio_files: list[str]
    runs: list[BenchmarkRunRecord]


@dataclass(frozen=True, slots=True)
class ReviewMetrics:
    reviewed_count: int
    correct_count: int
    false_coaching_count: int
    unreviewed_count: int
    precision: float | None
    recall: float | None
    f1: float | None
    false_coaching_rate: float | None


def false_coaching_rate(verdicts: Iterable[ReviewerVerdict]) -> float | None:
    """Return the false-coaching share for reviewed verdicts only."""
    reviewed = tuple(
        verdict for verdict in verdicts if verdict is not ReviewerVerdict.UNREVIEWED
    )
    if not reviewed:
        return None
    false_count = sum(
        verdict
        in (ReviewerVerdict.INCORRECT, ReviewerVerdict.NOT_A_COACHING_PROBLEM)
        for verdict in reviewed
    )
    return false_count / len(reviewed)


def summarize_review_metrics(
    events: Iterable[CoachingEvent],
    labels: Mapping[str, ReviewerVerdict],
) -> ReviewMetrics:
    """Summarize reviewer decisions without inferring unseen gold events."""
    event_ids = tuple(event.event_id for event in events)
    verdicts = tuple(labels.get(event_id, ReviewerVerdict.UNREVIEWED) for event_id in event_ids)
    reviewed = tuple(
        verdict for verdict in verdicts if verdict is not ReviewerVerdict.UNREVIEWED
    )
    correct_count = sum(verdict is ReviewerVerdict.CORRECT for verdict in reviewed)
    false_count = sum(
        verdict
        in (ReviewerVerdict.INCORRECT, ReviewerVerdict.NOT_A_COACHING_PROBLEM)
        for verdict in reviewed
    )
    precision = correct_count / len(reviewed) if reviewed else None
    return ReviewMetrics(
        reviewed_count=len(reviewed),
        correct_count=correct_count,
        false_coaching_count=false_count,
        unreviewed_count=len(event_ids) - len(reviewed),
        precision=precision,
        recall=None,
        f1=None,
        false_coaching_rate=false_coaching_rate(reviewed),
    )


def comparison_dataframe(
    audio_files: tuple[Path, ...],
    runs: tuple[BenchmarkedRun, ...],
    candidates: tuple[CandidateSpec, ...],
    statuses: Mapping[str, CandidateAvailability],
) -> pl.DataFrame:
    """Build one status row per selected audio file and candidate."""
    runs_by_key = {(run.audio_path, run.model_run.model_id): run for run in runs}
    rows: list[dict[str, str | float | None]] = []
    for audio_path in audio_files:
        for candidate in candidates:
            status = statuses[candidate.key]
            run = runs_by_key.get((audio_path, candidate.key))
            rows.append(_comparison_row(audio_path, candidate, status, run))
    return pl.DataFrame(rows)


def benchmark_report(
    language: str,
    audio_files: tuple[str, ...],
    runs: tuple[BenchmarkedRun, ...],
) -> BenchmarkReport:
    """Create a portable report that retains audio and decode provenance."""
    return {
        "language": language,
        "audio_files": list(audio_files),
        "runs": [_run_record(run) for run in runs],
    }


def write_benchmark_report(path: Path, report: BenchmarkReport) -> None:
    """Write a human-readable UTF-8 benchmark artifact."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def _comparison_row(
    audio_path: Path,
    candidate: CandidateSpec,
    status: CandidateAvailability,
    run: BenchmarkedRun | None,
) -> dict[str, str | float | None]:
    if run is None:
        return {
            "audio_file": audio_path.name,
            "model_id": candidate.key,
            "label": candidate.label,
            "status": "skipped" if not status.available else "not_run",
            "error": status.reason if not status.available else None,
            "total_seconds": None,
            "rtf": None,
            "model_load_seconds": None,
            "transcription_seconds": None,
            "analysis_seconds": None,
            "max_cpu_percent": None,
            "max_process_ram_mib": None,
            "max_gpu_percent": None,
            "max_vram_mib": None,
        }
    metrics = run.model_run.metrics
    return {
        "audio_file": audio_path.name,
        "model_id": candidate.key,
        "label": candidate.label,
        "status": "failed" if run.model_run.error else "success",
        "error": run.model_run.error,
        "total_seconds": run.total_seconds,
        "rtf": metrics.realtime_factor,
        "model_load_seconds": metrics.model_load_seconds,
        "transcription_seconds": metrics.transcription_seconds,
        "analysis_seconds": metrics.analysis_seconds,
        "max_cpu_percent": run.resources.max_cpu_percent,
        "max_process_ram_mib": run.resources.max_process_ram_mib,
        "max_gpu_percent": run.resources.max_gpu_percent,
        "max_vram_mib": run.resources.max_vram_mib,
    }


def _run_record(run: BenchmarkedRun) -> BenchmarkRunRecord:
    model_run = run.model_run
    return {
        "audio_file": run.audio_path.name,
        "model_id": model_run.model_id,
        "compute_type": model_run.compute_type,
        "gpu_name": model_run.gpu_name,
        "transcription_profile": model_run.transcription_profile,
        "transcription_variant": model_run.transcription_variant,
        "crisper_prompt_mode": model_run.crisper_prompt_mode,
        "words": [asdict(word) for word in model_run.words],
        "events": [
            {
                "event_id": event.event_id,
                "kind": event.kind,
                "start_seconds": event.start_seconds,
                "end_seconds": event.end_seconds,
                "text": event.text,
                "evidence": dict(event.evidence),
                "coaching_message": event.coaching_message,
                "confidence": event.confidence,
            }
            for event in model_run.events
        ],
        "metrics": asdict(model_run.metrics),
        "total_seconds": run.total_seconds,
        "resources": asdict(run.resources),
        "error": model_run.error,
    }
