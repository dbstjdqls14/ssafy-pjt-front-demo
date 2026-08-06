"""Decode profiles for Korean presentation transcription."""

from dataclasses import dataclass
from typing import Final, Literal


@dataclass(frozen=True, slots=True)
class FasterWhisperVadProfile:
    """Immutable Silero VAD options used before transcription."""

    threshold: float
    min_speech_duration_ms: int
    min_silence_duration_ms: int
    speech_pad_ms: int

    def __post_init__(self) -> None:
        if not 0.0 <= self.threshold <= 1.0:
            raise ValueError("threshold must be between 0.0 and 1.0")
        if self.min_speech_duration_ms < 0:
            raise ValueError("min_speech_duration_ms must be non-negative")
        if self.min_silence_duration_ms < 0:
            raise ValueError("min_silence_duration_ms must be non-negative")
        if self.speech_pad_ms < 0:
            raise ValueError("speech_pad_ms must be non-negative")

    def to_kwargs(self) -> dict[str, int | float]:
        return {
            "threshold": self.threshold,
            "min_speech_duration_ms": self.min_speech_duration_ms,
            "min_silence_duration_ms": self.min_silence_duration_ms,
            "speech_pad_ms": self.speech_pad_ms,
        }


@dataclass(frozen=True, slots=True)
class FasterWhisperDecodeProfile:
    """Immutable faster-whisper options for one presentation use case."""

    profile_id: str

    language: str
    task: Literal["transcribe"]

    initial_prompt: str | None
    hotwords: str | None

    vad: FasterWhisperVadProfile | None

    condition_on_previous_text: bool
    beam_size: int
    temperature: float

    compression_ratio_threshold: float | None
    no_speech_threshold: float | None
    log_prob_threshold: float | None

    word_timestamps: bool
    repetition_penalty: float
    no_repeat_ngram_size: int

    def __post_init__(self) -> None:
        if self.beam_size < 1:
            raise ValueError("beam_size must be at least 1")
        if self.temperature < 0.0:
            raise ValueError("temperature must be non-negative")

        if (
            self.no_speech_threshold is not None
            and not 0.0 <= self.no_speech_threshold <= 1.0
        ):
            raise ValueError(
                "no_speech_threshold must be between 0.0 and 1.0"
            )

        if self.repetition_penalty < 1.0:
            raise ValueError("repetition_penalty must be at least 1.0")

        if self.no_repeat_ngram_size < 0:
            raise ValueError("no_repeat_ngram_size must be non-negative")

    def to_transcribe_kwargs(self) -> dict[str, object]:
        return {
            "language": self.language,
            "task": self.task,
            "initial_prompt": self.initial_prompt,
            "hotwords": self.hotwords,
            "vad_filter": self.vad is not None,
            "vad_parameters": (
                self.vad.to_kwargs() if self.vad is not None else None
            ),
            "condition_on_previous_text": self.condition_on_previous_text,
            "beam_size": self.beam_size,
            "temperature": self.temperature,
            "compression_ratio_threshold": (
                self.compression_ratio_threshold
            ),
            "no_speech_threshold": self.no_speech_threshold,
            "log_prob_threshold": self.log_prob_threshold,
            "word_timestamps": self.word_timestamps,
            "without_timestamps": False,
            "repetition_penalty": self.repetition_penalty,
            "no_repeat_ngram_size": self.no_repeat_ngram_size,
        }


PRESENTATION_DISFLUENCY_PROFILE: Final = FasterWhisperDecodeProfile(
    profile_id="ko-presentation-disfluency-v3",
    language="ko",
    task="transcribe",

    initial_prompt=(
        "축어 전사입니다. 음, 어, 그와 같은 추임새, 반복, 말더듬, 끊긴 단어를 "
        "삭제하거나 문법적으로 고치지 말고 들린 그대로 전사하세요."
    ),

    # Populate dynamically with slide or script terminology.
    # Do not add filler words here because they may be hallucinated.
    hotwords=None,

    vad=None,

    # Reduces long-form repetition loops and timestamp drift.
    condition_on_previous_text=False,

    beam_size=5,
    temperature=0.0,

    compression_ratio_threshold=2.4,
    no_speech_threshold=0.85,
    log_prob_threshold=-1.0,

    # Required for locating fillers and repetitions.
    word_timestamps=True,

    # Never suppress repetitions in a disfluency profile.
    repetition_penalty=1.0,
    no_repeat_ngram_size=0,
)
