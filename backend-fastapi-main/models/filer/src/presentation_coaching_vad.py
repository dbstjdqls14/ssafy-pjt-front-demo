"""Silero-first VAD analysis with an explicitly marked NumPy fallback."""

from functools import lru_cache

import numpy as np
import torch

from presentation_coaching_audio_features import (
    FRAME_SAMPLES,
    TARGET_SAMPLE_RATE,
    VOICE_RMS_THRESHOLD,
    SpeechSpan,
    VADAnalysis,
    VADBackend,
    root_mean_square,
)


def vad_analysis(samples: np.ndarray) -> VADAnalysis:
    """Return authoritative Silero output or a visibly marked NumPy fallback."""
    silero_analysis = _silero_vad_analysis(samples)
    if silero_analysis is not None:
        return silero_analysis
    return VADAnalysis(_energy_vad_voiced_spans(samples), VADBackend.NUMPY_ENERGY_FALLBACK)


def _silero_vad_analysis(samples: np.ndarray) -> VADAnalysis | None:
    try:
        from silero_vad import get_speech_timestamps
    except ModuleNotFoundError:
        return None
    timestamps = get_speech_timestamps(
        torch.from_numpy(samples.copy()),
        _load_silero_model(),
        sampling_rate=TARGET_SAMPLE_RATE,
    )
    return VADAnalysis(
        tuple(
            SpeechSpan(
                timestamp["start"] / TARGET_SAMPLE_RATE,
                timestamp["end"] / TARGET_SAMPLE_RATE,
            )
            for timestamp in timestamps
        ),
        VADBackend.SILERO,
    )


@lru_cache(maxsize=1)
def _load_silero_model() -> torch.nn.Module:
    from silero_vad import load_silero_vad

    return load_silero_vad()


def _energy_vad_voiced_spans(samples: np.ndarray) -> tuple[SpeechSpan, ...]:
    spans: list[SpeechSpan] = []
    active_start_sample: int | None = None
    for start_sample in range(0, samples.size, FRAME_SAMPLES):
        end_sample = min(start_sample + FRAME_SAMPLES, samples.size)
        is_voiced = root_mean_square(samples[start_sample:end_sample]) >= VOICE_RMS_THRESHOLD
        if is_voiced and active_start_sample is None:
            active_start_sample = start_sample
        if not is_voiced and active_start_sample is not None:
            spans.append(_samples_to_span(active_start_sample, start_sample))
            active_start_sample = None
    if active_start_sample is not None:
        spans.append(_samples_to_span(active_start_sample, samples.size))
    return tuple(spans)


def _samples_to_span(start_sample: int, end_sample: int) -> SpeechSpan:
    return SpeechSpan(start_sample / TARGET_SAMPLE_RATE, end_sample / TARGET_SAMPLE_RATE)
