"""Automatic speech-rate and pitch-variation metrics for presentation coaching."""

from dataclasses import dataclass
from math import log2
from pathlib import Path
from typing import Final

import numpy as np

from presentation_coaching_audio import (
    TARGET_SAMPLE_RATE,
    SpeechSpan,
    load_wav_at_target_rate,
    slice_span,
)
from presentation_coaching_events import FILLER_CANDIDATES, TOKEN_EDGE_PUNCTUATION
from presentation_coaching_types import WordTiming
from presentation_coaching_vad import vad_analysis


SLOW_SPEAKING_RATE_SYLLABLES_PER_SECOND: Final = 4.0
FAST_SPEAKING_RATE_SYLLABLES_PER_SECOND: Final = 5.67
SLOW_ARTICULATION_RATE_SYLLABLES_PER_SECOND: Final = 4.5
FAST_ARTICULATION_RATE_SYLLABLES_PER_SECOND: Final = 7.0
MONOTONE_PITCH_RANGE_SEMITONES: Final = 3.0
MINIMUM_PITCH_VALUES: Final = 4
MAXIMUM_PITCH_ANALYSIS_SECONDS: Final = 12.0
VOCAL_INSTABILITY_CANDIDATE_INDEX: Final = 0.4
PITCH_HOP_SECONDS: Final = 512.0 / TARGET_SAMPLE_RATE
MINIMUM_MODULATION_SECONDS: Final = 2.0
MINIMUM_SHORT_VOICE_BREAK_SECONDS: Final = 0.07
MAXIMUM_SHORT_VOICE_BREAK_SECONDS: Final = 0.35


@dataclass(frozen=True, slots=True)
class DeliveryMetrics:
    """Automatic delivery measurements derived from ASR, VAD, and pitch."""

    syllable_count: int
    content_syllable_count: int
    filler_syllable_count: int
    speech_span_seconds: float
    speaking_rate_syllables_per_second: float
    speaking_rate_label: str
    voiced_seconds: float
    articulation_rate_syllables_per_second: float
    articulation_rate_label: str
    pitch_range_semitones: float | None
    delivery_label: str
    fluency_label: str
    vocal_instability_index: float | None = None
    vocal_stability_label: str = "측정 불가"
    pitch_irregularity_index: float | None = None
    loudness_irregularity_index: float | None = None
    short_voice_break_count: int = 0


def build_delivery_metrics(
    words: tuple[WordTiming, ...],
    voiced_seconds: float,
    pitch_hz: np.ndarray,
    *,
    speech_span_seconds: float | None = None,
    vocal_instability_index: float | None = None,
    pitch_irregularity_index: float | None = None,
    loudness_irregularity_index: float | None = None,
    short_voice_break_count: int = 0,
) -> DeliveryMetrics:
    """Build stable delivery labels from already measured ASR and acoustic values."""
    syllable_count = sum(_hangul_syllable_count(word.text) for word in words)
    filler_syllable_count = sum(
        _hangul_syllable_count(word.text) for word in words if _is_standalone_filler(word)
    )
    content_syllable_count = syllable_count - filler_syllable_count
    effective_speech_span_seconds = (
        speech_span_seconds if speech_span_seconds is not None else voiced_seconds
    )
    speaking_rate_syllables_per_second = (
        content_syllable_count / effective_speech_span_seconds
        if effective_speech_span_seconds
        else 0.0
    )
    articulation_rate_syllables_per_second = (
        content_syllable_count / voiced_seconds if voiced_seconds else 0.0
    )
    pitch_range_semitones = _pitch_range_semitones(pitch_hz)
    speaking_rate_label = _speaking_rate_label(
        speaking_rate_syllables_per_second, effective_speech_span_seconds
    )
    articulation_rate_label = _articulation_rate_label(
        articulation_rate_syllables_per_second, voiced_seconds
    )
    delivery_label = _delivery_label(pitch_range_semitones)
    vocal_stability_label = _vocal_stability_label(vocal_instability_index)
    return DeliveryMetrics(
        syllable_count,
        content_syllable_count,
        filler_syllable_count,
        effective_speech_span_seconds,
        speaking_rate_syllables_per_second,
        speaking_rate_label,
        voiced_seconds,
        articulation_rate_syllables_per_second,
        articulation_rate_label,
        pitch_range_semitones,
        delivery_label,
        _fluency_label(speaking_rate_label, delivery_label),
        vocal_instability_index,
        vocal_stability_label,
        pitch_irregularity_index,
        loudness_irregularity_index,
        short_voice_break_count,
    )


def measure_delivery_metrics(
    audio_path: Path, words: tuple[WordTiming, ...]
) -> DeliveryMetrics:
    """Measure speaking rate and pitch variation directly from presentation audio."""
    samples = load_wav_at_target_rate(audio_path)
    analysis = vad_analysis(samples)
    voiced_seconds = sum(
        span.end_seconds - span.start_seconds for span in analysis.voiced_spans
    )
    speech_span_seconds = _speech_span_seconds(analysis.voiced_spans)
    pitch_samples = _representative_voiced_samples(samples, analysis.voiced_spans)
    pitch_hz = _pitch_hz(pitch_samples)
    pitch_irregularity_index = _pitch_irregularity_index(pitch_hz)
    loudness_irregularity_index = _loudness_irregularity_index(pitch_samples)
    short_voice_break_count = _short_voice_break_count(words, analysis.voiced_spans)
    return build_delivery_metrics(
        words,
        voiced_seconds,
        pitch_hz,
        speech_span_seconds=speech_span_seconds,
        vocal_instability_index=_tension_voice_instability_index(
            pitch_irregularity_index,
            loudness_irregularity_index,
            short_voice_break_count,
        ),
        pitch_irregularity_index=pitch_irregularity_index,
        loudness_irregularity_index=loudness_irregularity_index,
        short_voice_break_count=short_voice_break_count,
    )


def _hangul_syllable_count(text: str) -> int:
    return sum("가" <= character <= "힣" for character in text)


def _is_standalone_filler(word: WordTiming) -> bool:
    return word.text.strip().strip(TOKEN_EDGE_PUNCTUATION) in FILLER_CANDIDATES


def _speaking_rate_label(syllables_per_second: float, duration_seconds: float) -> str:
    if duration_seconds <= 0.0:
        return "측정 불가"
    if syllables_per_second < SLOW_SPEAKING_RATE_SYLLABLES_PER_SECOND:
        return "느림"
    if syllables_per_second > FAST_SPEAKING_RATE_SYLLABLES_PER_SECOND:
        return "빠름"
    return "적정"


def _articulation_rate_label(
    syllables_per_second: float, duration_seconds: float
) -> str:
    if duration_seconds <= 0.0:
        return "측정 불가"
    if syllables_per_second < SLOW_ARTICULATION_RATE_SYLLABLES_PER_SECOND:
        return "느림"
    if syllables_per_second > FAST_ARTICULATION_RATE_SYLLABLES_PER_SECOND:
        return "빠름"
    return "적정"


def _speech_span_seconds(voiced_spans: tuple[SpeechSpan, ...]) -> float:
    if not voiced_spans:
        return 0.0
    return voiced_spans[-1].end_seconds - voiced_spans[0].start_seconds


def _pitch_range_semitones(pitch_hz: np.ndarray) -> float | None:
    finite_pitches = pitch_hz[np.isfinite(pitch_hz) & (pitch_hz > 0.0)]
    if finite_pitches.size < MINIMUM_PITCH_VALUES:
        return None
    lower_hz, upper_hz = np.percentile(finite_pitches, (10.0, 90.0))
    return float(12.0 * log2(float(upper_hz) / float(lower_hz)))


def _delivery_label(pitch_range_semitones: float | None) -> str:
    if pitch_range_semitones is None:
        return "피치 측정 불가"
    if pitch_range_semitones < MONOTONE_PITCH_RANGE_SEMITONES:
        return "단조 후보"
    return "변화 감지"


def _vocal_stability_label(vocal_instability_index: float | None) -> str:
    if vocal_instability_index is None:
        return "측정 불가"
    if vocal_instability_index >= VOCAL_INSTABILITY_CANDIDATE_INDEX:
        return "발성 불안정 후보"
    return "안정적"


def _fluency_label(speed_label: str, delivery_label: str) -> str:
    if speed_label == "측정 불가":
        return "말 속도 측정 불가"
    if delivery_label == "피치 측정 불가":
        return f"피치 측정 불가 · 말 속도 {speed_label}"
    if speed_label == "적정" and delivery_label == "변화 감지":
        return "말 속도·말투 변화 적정"
    if speed_label == "적정":
        return "말투 변화 조절 필요"
    if delivery_label == "변화 감지":
        return "말 속도 조절 필요"
    return "말 속도·말투 변화 조절 필요"


def _representative_voiced_samples(
    samples: np.ndarray, voiced_spans: tuple[SpeechSpan, ...]
) -> np.ndarray:
    if not voiced_spans:
        return np.asarray([], dtype=np.float32)
    sample_budget = round(MAXIMUM_PITCH_ANALYSIS_SECONDS * TARGET_SAMPLE_RATE)
    sample_limit_per_span = max(1, sample_budget // len(voiced_spans))
    selected = tuple(
        slice_span(samples, span)[:sample_limit_per_span] for span in voiced_spans
    )
    return np.concatenate(selected)


def _pitch_hz(samples: np.ndarray) -> np.ndarray:
    try:
        import librosa
    except ModuleNotFoundError:
        return np.asarray([], dtype=np.float64)
    pitches = librosa.yin(
        samples,
        fmin=75.0,
        fmax=400.0,
        sr=16_000,
    )
    return pitches


def _pitch_irregularity_index(pitch_hz: np.ndarray) -> float | None:
    finite_pitches = pitch_hz[np.isfinite(pitch_hz) & (pitch_hz > 0.0)]
    if finite_pitches.size < MINIMUM_PITCH_VALUES:
        return None
    semitones = 12.0 * np.log2(finite_pitches / np.median(finite_pitches))
    return min(1.0, float(np.median(np.abs(np.diff(semitones))) / 3.0))


def _loudness_irregularity_index(samples: np.ndarray) -> float | None:
    frames = np.asarray([
        float(np.sqrt(np.mean(np.square(samples[start : start + 512]))))
        for start in range(0, samples.size, 512)
    ])
    active = frames[frames > 0.005]
    if active.size < 4:
        return None
    return min(1.0, float(np.std(active) / np.mean(active)))


def _short_voice_break_count(
    words: tuple[WordTiming, ...], voiced_spans: tuple[SpeechSpan, ...]
) -> int:
    return sum(
        any(
            word.start_seconds <= previous.end_seconds
            and following.start_seconds <= word.end_seconds
            for word in words
        )
        for previous, following in zip(voiced_spans, voiced_spans[1:])
        if MINIMUM_SHORT_VOICE_BREAK_SECONDS
        <= following.start_seconds - previous.end_seconds
        <= MAXIMUM_SHORT_VOICE_BREAK_SECONDS
    )


def _tension_voice_instability_index(
    pitch_irregularity_index: float | None,
    loudness_irregularity_index: float | None,
    short_voice_break_count: int,
) -> float | None:
    values = tuple(
        value
        for value in (pitch_irregularity_index, loudness_irregularity_index)
        if value is not None
    )
    if not values:
        return None
    break_index = min(1.0, short_voice_break_count / 3.0)
    return min(1.0, 0.75 * sum(values) / len(values) + 0.25 * break_index)
