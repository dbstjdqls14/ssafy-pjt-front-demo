"""Review-only detection of hesitation-like prosody before internal pauses."""

from dataclasses import dataclass
from math import log2
from pathlib import Path
from statistics import median
from typing import Protocol

import numpy as np

from presentation_coaching_audio import SpeechSpan, load_wav_at_target_rate, slice_span
from presentation_coaching_types import CoachingEvent, EventKind, WordTiming


PITCH_RISE_MINIMUM_SEMITONES = 1.5
FINAL_WORD_DURATION_RATIO_MINIMUM = 1.4
FOLLOWING_DISFLUENCY_WINDOW_SECONDS = 0.8
SENTENCE_END_PUNCTUATION = frozenset(".!?\u3002\uff01\uff1f")


class PitchReader(Protocol):
    """Reads pitch samples for the short voiced interval before a detected pause."""

    def __call__(self, span: SpeechSpan) -> np.ndarray:
        """Return pitch values in hertz, with non-finite values for unavailable frames."""


@dataclass(frozen=True, slots=True)
class PrePauseProsodyCandidate:
    """A non-scoring combination of pause, pitch, duration, and disfluency evidence."""

    pause_start_seconds: float
    pause_end_seconds: float
    preceding_word: str
    pitch_change_semitones: float | None
    final_word_duration_ratio: float
    followed_by_disfluency: bool


def detect_pre_pause_prosody_candidates(
    words: tuple[WordTiming, ...],
    pauses: tuple[SpeechSpan, ...],
    events: tuple[CoachingEvent, ...],
    read_pitch: PitchReader,
) -> tuple[PrePauseProsodyCandidate, ...]:
    """Return only internal-pause candidates supported by at least two signals."""
    if not words:
        return ()
    median_word_duration = median(
        word.end_seconds - word.start_seconds for word in words
    )
    candidates = tuple(
        candidate
        for pause in pauses
        if (candidate := _candidate_for_pause(
            words, pause, events, read_pitch, median_word_duration
        )) is not None
    )
    return candidates


def measure_pre_pause_prosody_candidates(
    audio_path: Path,
    words: tuple[WordTiming, ...],
    pauses: tuple[SpeechSpan, ...],
    events: tuple[CoachingEvent, ...],
) -> tuple[PrePauseProsodyCandidate, ...]:
    """Measure review-only pre-pause prosody directly from a local WAV file."""
    samples = load_wav_at_target_rate(audio_path)

    def read_pitch(span: SpeechSpan) -> np.ndarray:
        return _pitch_hz(slice_span(samples, span))

    return detect_pre_pause_prosody_candidates(words, pauses, events, read_pitch)


def _candidate_for_pause(
    words: tuple[WordTiming, ...],
    pause: SpeechSpan,
    events: tuple[CoachingEvent, ...],
    read_pitch: PitchReader,
    median_word_duration: float,
) -> PrePauseProsodyCandidate | None:
    preceding_word = _preceding_word(words, pause)
    if preceding_word is None or _ends_sentence(preceding_word.text):
        return None
    pitch_span = SpeechSpan(max(0.0, pause.start_seconds - 0.4), pause.start_seconds)
    pitch_change = _pitch_change_semitones(read_pitch(pitch_span))
    duration_ratio = (preceding_word.end_seconds - preceding_word.start_seconds) / max(
        median_word_duration, 0.001
    )
    followed_by_disfluency = _has_following_disfluency(events, pause)
    signals = sum((pitch_change is not None and pitch_change >= PITCH_RISE_MINIMUM_SEMITONES,
                   duration_ratio >= FINAL_WORD_DURATION_RATIO_MINIMUM,
                   followed_by_disfluency))
    if signals < 2:
        return None
    return PrePauseProsodyCandidate(
        pause.start_seconds,
        pause.end_seconds,
        preceding_word.text,
        pitch_change,
        duration_ratio,
        followed_by_disfluency,
    )


def _preceding_word(
    words: tuple[WordTiming, ...], pause: SpeechSpan
) -> WordTiming | None:
    return next(
        (word for word in reversed(words) if word.end_seconds <= pause.start_seconds),
        None,
    )


def _ends_sentence(text: str) -> bool:
    return bool(text) and text.rstrip()[-1] in SENTENCE_END_PUNCTUATION


def _has_following_disfluency(
    events: tuple[CoachingEvent, ...], pause: SpeechSpan
) -> bool:
    return any(
        event.kind in (EventKind.FILLER, EventKind.REPETITION)
        and 0.0 <= event.start_seconds - pause.end_seconds <= FOLLOWING_DISFLUENCY_WINDOW_SECONDS
        for event in events
    )


def _pitch_change_semitones(pitches: np.ndarray) -> float | None:
    finite = pitches[np.isfinite(pitches) & (pitches > 0.0)]
    if finite.size < 4:
        return None
    midpoint = finite.size // 2
    first_half = float(np.median(finite[:midpoint]))
    second_half = float(np.median(finite[midpoint:]))
    return 12.0 * log2(second_half / first_half)


def _pitch_hz(samples: np.ndarray) -> np.ndarray:
    try:
        import librosa
    except ModuleNotFoundError:
        return np.asarray([], dtype=np.float64)
    return librosa.yin(samples, fmin=75.0, fmax=400.0, sr=16_000)
