"""Public VAD-backed pause detection and word-feature API for Korean coaching."""

from itertools import pairwise
from pathlib import Path

from presentation_coaching_audio_features import (
    AcousticFeatures,
    FRAME_SAMPLES,
    FRAME_SECONDS,
    InvalidMinimumSecondsError,
    InvalidSpeechSpanError,
    MAXIMUM_PITCH_HZ,
    MINIMUM_PITCH_HZ,
    PitchAnalysis,
    PitchBackend,
    SpeechSpan,
    TARGET_SAMPLE_RATE,
    UnsupportedWavFormatError,
    VADAnalysis,
    VADBackend,
    VOICE_RMS_THRESHOLD,
    load_wav_at_target_rate,
    overlap_seconds,
    pitch_analysis,
    rms_continuity,
    slice_span,
)
from presentation_coaching_vad import vad_analysis


__all__ = (
    "AcousticFeatures",
    "FRAME_SAMPLES",
    "FRAME_SECONDS",
    "InvalidMinimumSecondsError",
    "InvalidSpeechSpanError",
    "MAXIMUM_PITCH_HZ",
    "MINIMUM_PITCH_HZ",
    "PitchAnalysis",
    "PitchBackend",
    "SpeechSpan",
    "TARGET_SAMPLE_RATE",
    "UnsupportedWavFormatError",
    "VADAnalysis",
    "VADBackend",
    "VOICE_RMS_THRESHOLD",
    "detect_silences",
    "silences_from_voiced_spans",
    "measure_word_audio",
    "measure_word_audio_from_analysis",
)


def detect_silences(audio_path: Path, minimum_seconds: float) -> tuple[SpeechSpan, ...]:
    """Return only VAD-confirmed internal non-speech gaps at least the threshold."""
    if minimum_seconds < 0.0:
        raise InvalidMinimumSecondsError(minimum_seconds)
    return silences_from_voiced_spans(
        vad_analysis(load_wav_at_target_rate(audio_path)).voiced_spans,
        minimum_seconds,
    )


def silences_from_voiced_spans(
    voiced_spans: tuple[SpeechSpan, ...], minimum_seconds: float
) -> tuple[SpeechSpan, ...]:
    """Return internal VAD gaps from already computed voiced spans."""
    if minimum_seconds < 0.0:
        raise InvalidMinimumSecondsError(minimum_seconds)
    return tuple(
        SpeechSpan(previous.end_seconds, following.start_seconds)
        for previous, following in pairwise(voiced_spans)
        if following.start_seconds - previous.end_seconds >= minimum_seconds
    )


def measure_word_audio(audio_path: Path, word_span: SpeechSpan) -> AcousticFeatures:
    """Measure VAD-confirmed voicing, continuity, and pitch for one word interval."""
    samples = load_wav_at_target_rate(audio_path)
    return measure_word_audio_from_analysis(samples, vad_analysis(samples), word_span)


def measure_word_audio_from_analysis(
    samples, analysis: VADAnalysis, word_span: SpeechSpan
) -> AcousticFeatures:
    word_samples = slice_span(samples, word_span)
    duration_seconds = word_samples.size / TARGET_SAMPLE_RATE
    if duration_seconds == 0.0:
        return AcousticFeatures(
            0.0,
            0.0,
            False,
            VADBackend.NUMPY_ENERGY_FALLBACK,
            PitchBackend.NOT_APPLICABLE,
        )
    voiced_seconds = sum(
        overlap_seconds(word_span, voiced_span) for voiced_span in analysis.voiced_spans
    )
    voiced_fraction = min(1.0, voiced_seconds / duration_seconds)
    if voiced_fraction == 0.0:
        return AcousticFeatures(
            0.0,
            0.0,
            False,
            analysis.backend,
            PitchBackend.NOT_APPLICABLE,
        )
    pitch = pitch_analysis(word_samples)
    return AcousticFeatures(
        voiced_fraction,
        rms_continuity(word_samples),
        pitch.available,
        analysis.backend,
        pitch.backend,
    )
