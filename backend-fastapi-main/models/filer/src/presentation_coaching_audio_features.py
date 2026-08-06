"""Shared audio records, WAV decoding, and voiced-word acoustic features."""

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Final
import wave

import av
import numpy as np


TARGET_SAMPLE_RATE: Final = 16_000
FRAME_SECONDS: Final = 0.01
FRAME_SAMPLES: Final = round(TARGET_SAMPLE_RATE * FRAME_SECONDS)
VOICE_RMS_THRESHOLD: Final = 0.015
MINIMUM_PITCH_HZ: Final = 75.0
MAXIMUM_PITCH_HZ: Final = 400.0


@dataclass(frozen=True, slots=True)
class InvalidSpeechSpanError(ValueError):
    """Raised when a requested time span is negative or ends before it starts."""

    start_seconds: float
    end_seconds: float

    def __str__(self) -> str:
        return "Speech spans must start at or after zero and end at or after start."


@dataclass(frozen=True, slots=True)
class InvalidMinimumSecondsError(ValueError):
    """Raised when a silence threshold is negative."""

    minimum_seconds: float

    def __str__(self) -> str:
        return "The minimum silence duration must be zero or greater."


@dataclass(frozen=True, slots=True)
class UnsupportedWavFormatError(ValueError):
    """Raised when input is not a mono PCM WAV supported by the evaluator."""

    audio_path: Path
    detail: str

    def __str__(self) -> str:
        return f"Unsupported WAV input {self.audio_path}: {self.detail}."


class VADBackend(StrEnum):
    """The voice-activity backend that determined speech spans."""

    SILERO = "silero"
    NUMPY_ENERGY_FALLBACK = "numpy_energy_fallback"


class PitchBackend(StrEnum):
    """The pitch backend used after VAD has confirmed a voiced word span."""

    LIBROSA = "librosa"
    AUTOCORRELATION_FALLBACK = "autocorrelation_fallback"
    NOT_APPLICABLE = "not_applicable"


@dataclass(frozen=True, slots=True)
class SpeechSpan:
    """A VAD-derived or ASR-provided time interval measured in seconds."""

    start_seconds: float
    end_seconds: float

    def __post_init__(self) -> None:
        if self.start_seconds < 0.0 or self.end_seconds < self.start_seconds:
            raise InvalidSpeechSpanError(self.start_seconds, self.end_seconds)


@dataclass(frozen=True, slots=True)
class AcousticFeatures:
    """Evidence that distinguishes continuous voicing from silence in a word span."""

    voiced_fraction: float
    rms_continuity: float
    pitch_available: bool
    vad_backend: VADBackend
    pitch_backend: PitchBackend

    @property
    def used_fallback(self) -> bool:
        """Return whether any reported evidence came from a heuristic fallback."""
        return (
            self.vad_backend is VADBackend.NUMPY_ENERGY_FALLBACK
            or self.pitch_backend is PitchBackend.AUTOCORRELATION_FALLBACK
        )


@dataclass(frozen=True, slots=True)
class VADAnalysis:
    """Speech spans plus their authoritative VAD backend provenance."""

    voiced_spans: tuple[SpeechSpan, ...]
    backend: VADBackend

    @property
    def used_fallback(self) -> bool:
        """Return whether speech spans came from the NumPy energy fallback."""
        return self.backend is VADBackend.NUMPY_ENERGY_FALLBACK


@dataclass(frozen=True, slots=True)
class PitchAnalysis:
    """Pitch availability plus the backend that produced the evidence."""

    available: bool
    backend: PitchBackend


def load_wav_at_target_rate(audio_path: Path) -> np.ndarray:
    """Decode PCM WAV directly, or use PyAV for other common audio containers."""
    try:
        return _load_pcm_wav_at_target_rate(audio_path)
    except (wave.Error, UnsupportedWavFormatError):
        return _load_with_pyav_at_target_rate(audio_path)


def _load_pcm_wav_at_target_rate(audio_path: Path) -> np.ndarray:
    with wave.open(str(audio_path), "rb") as source:
        channels = source.getnchannels()
        sample_width = source.getsampwidth()
        sample_rate = source.getframerate()
        raw_frames = source.readframes(source.getnframes())
    if channels != 1:
        raise UnsupportedWavFormatError(audio_path, "audio must have one channel")
    samples = _decode_pcm(raw_frames, sample_width, audio_path)
    if sample_rate == TARGET_SAMPLE_RATE:
        return samples
    return _resample_to_target_rate(samples, sample_rate)


def _load_with_pyav_at_target_rate(audio_path: Path) -> np.ndarray:
    decoded_chunks: list[np.ndarray] = []
    try:
        with av.open(str(audio_path)) as container:
            stream = container.streams.audio[0]
            resampler = av.audio.resampler.AudioResampler(
                format="flt",
                layout="mono",
                rate=TARGET_SAMPLE_RATE,
            )
            for frame in container.decode(stream):
                decoded_chunks.extend(
                    output.to_ndarray().reshape(-1)
                    for output in resampler.resample(frame)
                )
            decoded_chunks.extend(
                output.to_ndarray().reshape(-1)
                for output in resampler.resample(None)
            )
    except (av.FFmpegError, IndexError) as error:
        raise UnsupportedWavFormatError(audio_path, "PyAV could not decode an audio stream") from error
    if not decoded_chunks:
        raise UnsupportedWavFormatError(audio_path, "no audio samples were decoded")
    return np.concatenate(decoded_chunks).astype(np.float32, copy=False)


def slice_span(samples: np.ndarray, span: SpeechSpan) -> np.ndarray:
    """Return the sample interval corresponding to a bounded speech span."""
    start_sample = min(samples.size, round(span.start_seconds * TARGET_SAMPLE_RATE))
    end_sample = min(samples.size, round(span.end_seconds * TARGET_SAMPLE_RATE))
    return samples[start_sample:end_sample]


def overlap_seconds(first: SpeechSpan, second: SpeechSpan) -> float:
    """Return the duration shared by two speech spans."""
    return max(0.0, min(first.end_seconds, second.end_seconds) - max(first.start_seconds, second.start_seconds))


def rms_continuity(samples: np.ndarray) -> float:
    """Return the fraction of frames whose voiced energy remains stable."""
    frame_rms = np.asarray(
        [
            root_mean_square(samples[start : start + FRAME_SAMPLES])
            for start in range(0, samples.size, FRAME_SAMPLES)
        ],
        dtype=np.float64,
    )
    voiced_frames = frame_rms >= VOICE_RMS_THRESHOLD
    if not np.any(voiced_frames):
        return 0.0
    reference_rms = float(np.median(frame_rms[voiced_frames]))
    stable_frames = voiced_frames & (frame_rms >= reference_rms / 2.0)
    return float(np.mean(stable_frames))


def pitch_analysis(samples: np.ndarray) -> PitchAnalysis:
    """Determine pitch availability and disclose the backend that produced it."""
    if root_mean_square(samples) < VOICE_RMS_THRESHOLD:
        return PitchAnalysis(False, PitchBackend.NOT_APPLICABLE)
    try:
        import librosa
    except ModuleNotFoundError:
        return PitchAnalysis(
            _autocorrelation_has_pitch(samples),
            PitchBackend.AUTOCORRELATION_FALLBACK,
        )
    pitches, _, _ = librosa.pyin(
        samples,
        fmin=MINIMUM_PITCH_HZ,
        fmax=MAXIMUM_PITCH_HZ,
        sr=TARGET_SAMPLE_RATE,
    )
    return PitchAnalysis(bool(np.isfinite(pitches).any()), PitchBackend.LIBROSA)


def root_mean_square(samples: np.ndarray) -> float:
    """Return the RMS amplitude of samples, treating an empty interval as silent."""
    if samples.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))


def _decode_pcm(raw_frames: bytes, sample_width: int, audio_path: Path) -> np.ndarray:
    if sample_width not in (1, 2, 4):
        raise UnsupportedWavFormatError(audio_path, f"{sample_width}-byte PCM is not supported")
    if sample_width == 1:
        return (np.frombuffer(raw_frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    if sample_width == 2:
        return np.frombuffer(raw_frames, dtype="<i2").astype(np.float32) / 32_768.0
    return np.frombuffer(raw_frames, dtype="<i4").astype(np.float32) / 2_147_483_648.0


def _resample_to_target_rate(samples: np.ndarray, source_rate: int) -> np.ndarray:
    if samples.size == 0:
        return samples
    target_size = round(samples.size * TARGET_SAMPLE_RATE / source_rate)
    source_positions = np.arange(samples.size, dtype=np.float64)
    target_positions = np.linspace(0.0, samples.size - 1.0, target_size)
    return np.interp(target_positions, source_positions, samples).astype(np.float32)


def _autocorrelation_has_pitch(samples: np.ndarray) -> bool:
    analysis = samples[: min(samples.size, 4096)].astype(np.float64)
    analysis -= np.mean(analysis)
    correlation = np.correlate(analysis, analysis, mode="full")[analysis.size - 1 :]
    minimum_lag = round(TARGET_SAMPLE_RATE / MAXIMUM_PITCH_HZ)
    maximum_lag = min(round(TARGET_SAMPLE_RATE / MINIMUM_PITCH_HZ), correlation.size - 1)
    if maximum_lag <= minimum_lag or correlation[0] <= 0.0:
        return False
    peak = float(np.max(correlation[minimum_lag : maximum_lag + 1]))
    return peak / float(correlation[0]) >= 0.2
