import re
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Final, Protocol, TypeAlias

import numpy as np
from numpy.typing import NDArray

from presentation_coaching_audio import TARGET_SAMPLE_RATE, load_wav_at_target_rate
from presentation_coaching_events import TOKEN_EDGE_PUNCTUATION
from presentation_coaching_types import WordTiming


FILLER_TOKEN_PATTERN: Final = re.compile(r"^[^가-힣]*(아|어|음|그)(?:[아어음그])?[^가-힣]*$")
FILLER_MERGE_TOLERANCE_SECONDS: Final = 0.3
FILLER_RESCUE_WINDOW_SECONDS: Final = 8.0
FILLER_RESCUE_STRIDE_SECONDS: Final = 8.0

AudioSamples: TypeAlias = NDArray[np.float32]
TranscribeOptionValue: TypeAlias = str | float | int | bool | None | dict[str, int | float]
TranscribeOptions: TypeAlias = Mapping[str, TranscribeOptionValue]


class _RawWord(Protocol):
    word: str
    start: float
    end: float


class _RawSegment(Protocol):
    words: Sequence[_RawWord] | None


class _TranscriptionInfo(Protocol):
    pass


class FasterWhisperModel(Protocol):
    def transcribe(
        self, audio: str | AudioSamples, **kwargs: TranscribeOptionValue
    ) -> tuple[Iterable[_RawSegment], _TranscriptionInfo]: ...


def is_standalone_filler(word: WordTiming) -> bool:
    return FILLER_TOKEN_PATTERN.fullmatch(word.text) is not None


def merge_rescued_fillers(
    primary_words: tuple[WordTiming, ...], rescued_words: tuple[WordTiming, ...]
) -> tuple[WordTiming, ...]:
    primary_fillers = tuple(word for word in primary_words if is_standalone_filler(word))
    additions: list[WordTiming] = []
    for word in sorted(rescued_words, key=_word_sort_key):
        if is_standalone_filler(word) and not _has_nearby_same_filler(
            word, (*primary_fillers, *additions)
        ):
            additions.append(word)
    return tuple(sorted((*primary_words, *additions), key=_word_sort_key))


def transcribe_with_filler_rescue(
    model: FasterWhisperModel,
    audio_path: Path,
    options: TranscribeOptions,
) -> tuple[WordTiming, ...]:
    primary_segments, _ = model.transcribe(str(audio_path), **options)
    primary_words = _word_timings(primary_segments, 0.0)
    samples = load_wav_at_target_rate(audio_path)
    return merge_rescued_fillers(
        primary_words, _rescue_filler_words(model, samples, options)
    )


def transcribe_without_filler_rescue(
    model: FasterWhisperModel,
    audio_path: Path,
    options: TranscribeOptions,
) -> tuple[WordTiming, ...]:
    primary_segments, _ = model.transcribe(str(audio_path), **options)
    return _word_timings(primary_segments, 0.0)


def rescue_filler_words_from_samples(
    model: FasterWhisperModel,
    samples: AudioSamples,
    options: TranscribeOptions,
    *,
    window_seconds: float = FILLER_RESCUE_WINDOW_SECONDS,
) -> tuple[WordTiming, ...]:
    return _rescue_filler_words(model, samples, options, window_seconds)


def _rescue_filler_words(
    model: FasterWhisperModel,
    samples: AudioSamples,
    options: TranscribeOptions,
    window_seconds: float = FILLER_RESCUE_WINDOW_SECONDS,
) -> tuple[WordTiming, ...]:
    return tuple(
        word
        for start_sample in _window_starts(samples.size, window_seconds)
        for word in _decode_window(
            model, samples, start_sample, options, window_seconds
        )
    )


def _has_nearby_same_filler(
    word: WordTiming, candidates: tuple[WordTiming, ...]
) -> bool:
    return any(
        _normalized_filler(candidate) == _normalized_filler(word)
        and (
            abs(candidate.start_seconds - word.start_seconds)
            <= FILLER_MERGE_TOLERANCE_SECONDS
            or (
                candidate.start_seconds < word.end_seconds
                and word.start_seconds < candidate.end_seconds
            )
        )
        for candidate in candidates
    )


def _decode_window(
    model: FasterWhisperModel,
    samples: AudioSamples,
    start_sample: int,
    options: TranscribeOptions,
    window_seconds: float,
) -> tuple[WordTiming, ...]:
    window_samples = round(window_seconds * TARGET_SAMPLE_RATE)
    segments, _ = model.transcribe(
        samples[start_sample : start_sample + window_samples], **options
    )
    return _word_timings(segments, start_sample / TARGET_SAMPLE_RATE)


def _window_starts(
    sample_count: int, window_seconds: float = FILLER_RESCUE_WINDOW_SECONDS
) -> tuple[int, ...]:
    window_samples = round(window_seconds * TARGET_SAMPLE_RATE)
    stride_samples = round(window_seconds * TARGET_SAMPLE_RATE)
    if sample_count <= 0:
        return ()
    final_start_sample = max(0, sample_count - window_samples)
    starts = tuple(range(0, final_start_sample + 1, stride_samples))
    return starts if starts[-1] == final_start_sample else (*starts, final_start_sample)


def _word_timings(
    segments: Iterable[_RawSegment], start_offset_seconds: float
) -> tuple[WordTiming, ...]:
    return tuple(
        WordTiming(
            word.word.strip(),
            start_offset_seconds + word.start,
            start_offset_seconds + word.end,
        )
        for segment in segments
        for word in (segment.words or ())
        if word.word.strip()
    )


def _normalized_filler(word: WordTiming) -> str:
    return word.text.strip().strip(TOKEN_EDGE_PUNCTUATION)


def _word_sort_key(word: WordTiming) -> tuple[float, float, str]:
    return word.start_seconds, word.end_seconds, word.text
