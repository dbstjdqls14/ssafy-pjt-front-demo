from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256
from typing import Final, assert_never

import numpy as np

from presentation_coaching_audio import FRAME_SAMPLES, TARGET_SAMPLE_RATE
from presentation_coaching_events import FILLER_CANDIDATES, TOKEN_EDGE_PUNCTUATION
from presentation_coaching_types import CoachingEvent, EventKind, WordTiming


FRAME_SECONDS: Final = FRAME_SAMPLES / TARGET_SAMPLE_RATE
MINIMUM_WORD_SECONDS: Final = 0.4
MAXIMUM_INITIAL_FRAGMENT_SECONDS: Final = 0.28
MAXIMUM_BREAK_START_SECONDS: Final = 0.35
MINIMUM_BREAK_SECONDS: Final = 0.15
MAXIMUM_BREAK_SECONDS: Final = 0.35
MINIMUM_RESTART_SECONDS: Final = 0.12
MINIMUM_ACTIVITY_RMS: Final = 0.005
RELATIVE_ACTIVITY_RMS: Final = 0.25


class AcousticStutterKind(StrEnum):
    BLOCK = "block"


@dataclass(frozen=True, slots=True)
class AcousticStutterCandidate:
    kind: AcousticStutterKind
    start_seconds: float
    end_seconds: float
    interruption_seconds: float
    initial_fragment_seconds: float
    restarted_voice_seconds: float
    stt_word: str


@dataclass(frozen=True, slots=True)
class _FrameRun:
    start_index: int
    end_index: int
    active: bool

    @property
    def seconds(self) -> float:
        return (self.end_index - self.start_index) * FRAME_SECONDS


def detect_acoustic_stutter_candidates(
    samples: np.ndarray, words: tuple[WordTiming, ...]
) -> tuple[AcousticStutterCandidate, ...]:
    return tuple(
        candidate
        for word in words
        if _is_content_word(word)
        for candidate in _candidates_for_word(samples, word)
    )


def to_coaching_events(
    candidates: tuple[AcousticStutterCandidate, ...],
) -> tuple[CoachingEvent, ...]:
    return tuple(_to_coaching_event(candidate) for candidate in candidates)


def merge_acoustic_stutter_events(
    existing_events: tuple[CoachingEvent, ...],
    acoustic_events: tuple[CoachingEvent, ...],
) -> tuple[CoachingEvent, ...]:
    additions = tuple(
        acoustic_event
        for acoustic_event in acoustic_events
        if not any(
            existing_event.kind is EventKind.REPETITION
            and _overlaps(existing_event, acoustic_event)
            for existing_event in existing_events
        )
    )
    return tuple(
        sorted(
            (*existing_events, *additions),
            key=lambda event: (
                event.start_seconds,
                event.end_seconds,
                event.kind.value,
                event.text,
            ),
        )
    )


def _is_content_word(word: WordTiming) -> bool:
    token = word.text.strip().strip(TOKEN_EDGE_PUNCTUATION)
    return (
        bool(token)
        and token not in FILLER_CANDIDATES
        and word.end_seconds - word.start_seconds >= MINIMUM_WORD_SECONDS
    )


def _candidates_for_word(
    samples: np.ndarray, word: WordTiming
) -> tuple[AcousticStutterCandidate, ...]:
    word_samples = _word_samples(samples, word)
    if word_samples.size < FRAME_SAMPLES:
        return ()
    runs = _activity_runs(word_samples)
    return tuple(
        candidate
        for previous, interruption, following in zip(runs, runs[1:], runs[2:])
        if (candidate := _candidate_from_runs(word, previous, interruption, following))
        is not None
    )


def _word_samples(samples: np.ndarray, word: WordTiming) -> np.ndarray:
    start_sample = max(0, round(word.start_seconds * TARGET_SAMPLE_RATE))
    end_sample = min(samples.size, round(word.end_seconds * TARGET_SAMPLE_RATE))
    return samples[start_sample:end_sample]


def _overlaps(first: CoachingEvent, second: CoachingEvent) -> bool:
    return (
        first.start_seconds < second.end_seconds
        and second.start_seconds < first.end_seconds
    )


def _activity_runs(samples: np.ndarray) -> tuple[_FrameRun, ...]:
    frame_rms = np.asarray(
        [
            float(np.sqrt(np.mean(np.square(samples[start : start + FRAME_SAMPLES]))))
            for start in range(0, samples.size, FRAME_SAMPLES)
        ],
        dtype=np.float32,
    )
    active_values = frame_rms[frame_rms >= MINIMUM_ACTIVITY_RMS]
    relative_threshold = (
        float(np.median(active_values)) * RELATIVE_ACTIVITY_RMS
        if active_values.size
        else MINIMUM_ACTIVITY_RMS
    )
    activity = frame_rms >= max(MINIMUM_ACTIVITY_RMS, relative_threshold)
    return _runs(activity)


def _runs(activity: np.ndarray) -> tuple[_FrameRun, ...]:
    if activity.size == 0:
        return ()
    runs: list[_FrameRun] = []
    start_index = 0
    active = bool(activity[0])
    for index, value in enumerate(activity[1:], start=1):
        is_active = bool(value)
        if is_active != active:
            runs.append(_FrameRun(start_index, index, active))
            start_index = index
            active = is_active
    runs.append(_FrameRun(start_index, activity.size, active))
    return tuple(runs)


def _candidate_from_runs(
    word: WordTiming,
    initial: _FrameRun,
    interruption: _FrameRun,
    restart: _FrameRun,
) -> AcousticStutterCandidate | None:
    if (
        not initial.active
        or interruption.active
        or not restart.active
        or initial.seconds > MAXIMUM_INITIAL_FRAGMENT_SECONDS
        or interruption.start_index * FRAME_SECONDS > MAXIMUM_BREAK_START_SECONDS
        or not MINIMUM_BREAK_SECONDS <= interruption.seconds <= MAXIMUM_BREAK_SECONDS
        or restart.seconds < MINIMUM_RESTART_SECONDS
    ):
        return None
    start_seconds = word.start_seconds + interruption.start_index * FRAME_SECONDS
    end_seconds = word.start_seconds + interruption.end_index * FRAME_SECONDS
    return AcousticStutterCandidate(
        AcousticStutterKind.BLOCK,
        start_seconds,
        end_seconds,
        interruption.seconds,
        initial.seconds,
        restart.seconds,
        word.text,
    )


def _to_coaching_event(candidate: AcousticStutterCandidate) -> CoachingEvent:
    match candidate.kind:
        case AcousticStutterKind.BLOCK:
            unit = "acoustic_block"
            message = (
                f"'{candidate.stt_word}' 앞에서 짧은 발성 뒤 {candidate.interruption_seconds:.2f}초의 "
                "무성 단절과 재시작이 확인되었습니다."
            )
        case unreachable:
            assert_never(unreachable)
    identity = (
        f"{unit}|{candidate.start_seconds:.3f}|{candidate.end_seconds:.3f}|"
        f"{candidate.stt_word}"
    )
    return CoachingEvent(
        f"repetition-{sha256(identity.encode()).hexdigest()[:12]}",
        EventKind.REPETITION,
        candidate.start_seconds,
        candidate.end_seconds,
        candidate.stt_word,
        {
            "repetition_unit": unit,
            "detection_source": "acoustic_stt_fusion",
            "interruption_seconds": candidate.interruption_seconds,
            "initial_fragment_seconds": candidate.initial_fragment_seconds,
            "restarted_voice_seconds": candidate.restarted_voice_seconds,
            "stt_word": candidate.stt_word,
        },
        message,
        "low",
    )
