from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import RLock
from typing import Final, Iterator, Protocol
import wave

import numpy as np

from presentation_coaching_audio import TARGET_SAMPLE_RATE, load_wav_at_target_rate
from presentation_coaching_filler_rescue import FILLER_RESCUE_WINDOW_SECONDS, _window_starts
from presentation_coaching_types import WordTiming

REQUIRED_CT2_WHISPER_APIS: Final = (
    "prefill",
    "forward_step",
    "set_alignment_heads",
    "generate_greedy_with_attention",
)
_PROMPT_BUILDER_LOCK = RLock()


class _CrisperWord(Protocol):
    word: str
    start: float | None
    end: float | None


class _CrisperTranscriptionResult(Protocol):
    text: str
    words: list[_CrisperWord] | None


class CrisperTranscriptionModel(Protocol):
    def transcribe(
        self,
        audio: Path,
        *,
        language: str,
        mode: str,
        word_timestamps: bool,
        hallucination_mitigation: bool,
    ) -> _CrisperTranscriptionResult: ...


def crisper_ct2_unavailability_reason() -> str | None:
    """Return why the installed CTranslate2 cannot produce Crisper word timings."""
    try:
        import ctranslate2
    except ModuleNotFoundError:
        return "CrisperWhisper CT2 runtime is not installed."
    whisper = getattr(ctranslate2.models, "Whisper", None)
    missing = tuple(api for api in REQUIRED_CT2_WHISPER_APIS if not hasattr(whisper, api))
    if not missing:
        return None
    return (
        "CrisperWhisper CT2 runtime is unavailable: the installed upstream "
        f"ctranslate2 lacks {', '.join(missing)}."
    )


def transcribe_korean_with_transformers_fallback(
    model: CrisperTranscriptionModel,
    audio_path: Path,
    *,
    language: str,
    word_timestamps: bool,
    hallucination_mitigation: bool = True,
) -> _CrisperTranscriptionResult:
    with _neutral_korean_prompt():
        return model.transcribe(
            audio_path,
            language=language,
            mode="verbatim",
            word_timestamps=word_timestamps,
            hallucination_mitigation=hallucination_mitigation,
        )


def transcribe_korean_native_verbatim(
    model: CrisperTranscriptionModel,
    audio_path: Path,
    *,
    language: str,
    word_timestamps: bool,
    hallucination_mitigation: bool = True,
) -> _CrisperTranscriptionResult:
    return model.transcribe(
        audio_path,
        language=language,
        mode="verbatim",
        word_timestamps=word_timestamps,
        hallucination_mitigation=hallucination_mitigation,
    )


def rescue_crisper_filler_words(
    model: CrisperTranscriptionModel,
    audio_path: Path,
    *,
    language: str,
    word_timestamps: bool,
    use_neutral_prompt: bool = True,
    hallucination_mitigation: bool = True,
    window_seconds: float = FILLER_RESCUE_WINDOW_SECONDS,
) -> tuple[WordTiming, ...]:
    samples = load_wav_at_target_rate(audio_path)
    with TemporaryDirectory(prefix="crisper-filler-rescue-") as directory:
        temporary_directory = Path(directory)
        rescued_words: list[WordTiming] = []
        for index, start_sample in enumerate(_window_starts(samples.size, window_seconds)):
            window_path = temporary_directory / f"window-{index}.wav"
            _write_mono_wav(
                window_path,
                samples[start_sample : start_sample + round(window_seconds * TARGET_SAMPLE_RATE)],
            )
            if use_neutral_prompt:
                result = transcribe_korean_with_transformers_fallback(
                    model,
                    window_path,
                    language=language,
                    word_timestamps=word_timestamps,
                    hallucination_mitigation=hallucination_mitigation,
                )
            else:
                result = transcribe_korean_native_verbatim(
                    model,
                    window_path,
                    language=language,
                    word_timestamps=word_timestamps,
                    hallucination_mitigation=hallucination_mitigation,
                )
            start_seconds = start_sample / TARGET_SAMPLE_RATE
            rescued_words.extend(
                WordTiming(
                    word.text,
                    start_seconds + word.start_seconds,
                    start_seconds + word.end_seconds,
                )
                for word in crisper_word_timings(result)
            )
    return tuple(rescued_words)


def _write_mono_wav(path: Path, samples: np.ndarray) -> None:
    pcm = np.clip(samples, -1.0, 1.0)
    pcm16 = (pcm * np.iinfo(np.int16).max).astype(np.int16)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(TARGET_SAMPLE_RATE)
        output.writeframes(pcm16.tobytes())


def crisper_word_timings(result: _CrisperTranscriptionResult) -> tuple[WordTiming, ...]:
    aligned_words = tuple(
        word
        for word in result.words or ()
        if word.word.strip() and word.start is not None and word.end is not None
    )
    transcript_words = tuple(word for word in result.text.split() if word)
    if not transcript_words or "\ufffd" in result.text:
        return tuple(
            WordTiming(word.word.strip(), word.start, word.end)
            for word in aligned_words
            if "\ufffd" not in word.word
        )
    if len(transcript_words) == len(aligned_words):
        return tuple(
            WordTiming(text, word.start, word.end)
            for text, word in zip(transcript_words, aligned_words)
            if "\ufffd" not in text
        )
    if not aligned_words:
        return ()
    return tuple(
        WordTiming(
            text,
            aligned_words[int(index * len(aligned_words) / len(transcript_words))].start,
            aligned_words[min(len(aligned_words) - 1, max(int(index * len(aligned_words) / len(transcript_words)), int((index + 1) * len(aligned_words) / len(transcript_words)) - 1))].end,
        )
        for index, text in enumerate(transcript_words)
        if "\ufffd" not in text
    )


@contextmanager
def _neutral_korean_prompt() -> Iterator[None]:
    from crisperwhisper import prompt

    class NeutralKoreanPromptBuilder(prompt.PromptBuilder):
        def _build(
            self,
            mode: str,
            hotwords: list[str] | None = None,
            context: str | None = None,
        ) -> list[int]:
            return list(self._decoder_prefix)

    with _PROMPT_BUILDER_LOCK:
        original_builder = prompt.PromptBuilder
        prompt.PromptBuilder = NeutralKoreanPromptBuilder
        try:
            yield
        finally:
            prompt.PromptBuilder = original_builder
