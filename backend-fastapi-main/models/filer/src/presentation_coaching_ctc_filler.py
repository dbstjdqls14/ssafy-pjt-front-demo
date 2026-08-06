from collections.abc import Iterable
from dataclasses import dataclass
from itertools import islice
from pathlib import Path
from string import punctuation
from typing import Final
from unicodedata import normalize

import numpy as np
from numpy.typing import NDArray

from presentation_coaching_audio import TARGET_SAMPLE_RATE, load_wav_at_target_rate
from presentation_coaching_events import FILLER_CANDIDATES, TOKEN_EDGE_PUNCTUATION
from presentation_coaching_types import WordTiming


KOREAN_CTC_MODEL_ID: Final = "Kkonjeong/wav2vec2-base-korean"
CTC_WINDOW_SECONDS: Final = 0.75
CTC_WINDOW_STRIDE_SECONDS: Final = 0.25
CTC_MINIMUM_CONFIDENCE: Final = 0.85
CTC_CONSENSUS_OCCURRENCES: Final = 2
CTC_MERGE_TOLERANCE_SECONDS: Final = 0.35

AudioSamples = NDArray[np.float32]


@dataclass(frozen=True, slots=True)
class CTCDecodedSpan:
    text: str
    start_seconds: float
    end_seconds: float
    confidence: float


@dataclass(frozen=True, slots=True)
class CTCFillerCandidate:
    text: str
    start_seconds: float
    end_seconds: float
    confidence: float
    consensus_count: int

    def as_word_timing(self) -> WordTiming:
        return WordTiming(self.text, self.start_seconds, self.end_seconds)


def ctc_window_starts(sample_count: int) -> tuple[int, ...]:
    if sample_count <= 0:
        return ()
    window_samples = round(CTC_WINDOW_SECONDS * TARGET_SAMPLE_RATE)
    stride_samples = round(CTC_WINDOW_STRIDE_SECONDS * TARGET_SAMPLE_RATE)
    final_start = max(0, sample_count - window_samples)
    starts = tuple(range(0, final_start + 1, stride_samples))
    return starts if starts[-1] == final_start else (*starts, final_start)


def select_consensus_filler_candidates(
    decoded_spans: Iterable[CTCDecodedSpan],
) -> tuple[CTCFillerCandidate, ...]:
    eligible = sorted(
        (
            CTCDecodedSpan(
                normalized,
                span.start_seconds,
                span.end_seconds,
                span.confidence,
            )
            for span in decoded_spans
            if (normalized := _normalized_filler(span.text)) in FILLER_CANDIDATES
            and span.confidence >= CTC_MINIMUM_CONFIDENCE
        ),
        key=lambda span: (span.text, span.start_seconds, span.end_seconds),
    )
    candidates: list[CTCFillerCandidate] = []
    for text in FILLER_CANDIDATES:
        matching = [span for span in eligible if span.text == text]
        while matching:
            cluster = [matching.pop(0)]
            while (
                matching
                and matching[0].start_seconds - cluster[-1].start_seconds
                <= CTC_MERGE_TOLERANCE_SECONDS
            ):
                cluster.append(matching.pop(0))
            if len(cluster) >= CTC_CONSENSUS_OCCURRENCES:
                best = max(cluster, key=lambda span: span.confidence)
                candidates.append(
                    CTCFillerCandidate(
                        best.text,
                        best.start_seconds,
                        best.end_seconds,
                        best.confidence,
                        len(cluster),
                    )
                )
    return tuple(sorted(candidates, key=lambda candidate: candidate.start_seconds))


class KoreanCTCFillerScanner:
    def __init__(
        self,
        model_id: str = KOREAN_CTC_MODEL_ID,
        batch_size: int = 8,
        device: str | None = None,
    ) -> None:
        if batch_size < 1:
            raise ValueError("batch_size must be positive")
        import torch
        from transformers import AutoModelForCTC, AutoProcessor

        self._torch = torch
        self._batch_size = batch_size
        self._device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self._processor = AutoProcessor.from_pretrained(model_id, local_files_only=True)
        self._model = AutoModelForCTC.from_pretrained(
            model_id, local_files_only=True
        ).to(self._device)
        self._model.eval()
        self._blank_id = self._processor.tokenizer.pad_token_id

    def find_candidates(self, audio_path: Path) -> tuple[CTCFillerCandidate, ...]:
        samples = load_wav_at_target_rate(audio_path)
        return self.find_candidates_from_samples(samples)

    def find_candidates_from_samples(
        self, samples: AudioSamples
    ) -> tuple[CTCFillerCandidate, ...]:
        return select_consensus_filler_candidates(self.decode_samples(samples))

    def decode_samples(self, samples: AudioSamples) -> tuple[CTCDecodedSpan, ...]:
        starts = ctc_window_starts(samples.size)
        decoded: list[CTCDecodedSpan] = []
        for start_batch in _batched(starts, self._batch_size):
            windows = [
                samples[start : start + round(CTC_WINDOW_SECONDS * TARGET_SAMPLE_RATE)]
                for start in start_batch
            ]
            decoded.extend(self._decode_batch(windows, start_batch))
        return tuple(decoded)

    def close(self) -> None:
        del self._model
        if self._device == "cuda":
            self._torch.cuda.empty_cache()

    def _decode_batch(
        self, windows: list[AudioSamples], starts: tuple[int, ...]
    ) -> tuple[CTCDecodedSpan, ...]:
        inputs = self._processor(
            windows,
            sampling_rate=TARGET_SAMPLE_RATE,
            return_tensors="pt",
            padding=True,
        )
        inputs = {name: value.to(self._device) for name, value in inputs.items()}
        with self._torch.inference_mode():
            logits = self._model(**inputs).logits
        token_ids = logits.argmax(dim=-1).cpu()
        token_confidence = logits.softmax(dim=-1).amax(dim=-1).cpu()
        spans: list[CTCDecodedSpan] = []
        for window, start, ids, confidence in zip(
            windows, starts, token_ids, token_confidence, strict=True
        ):
            active = (ids != self._blank_id).nonzero().flatten()
            if active.numel() == 0:
                continue
            first, last = int(active[0]), int(active[-1]) + 1
            text = self._processor.decode(ids[first:last].tolist()).strip()
            frame_seconds = window.size / TARGET_SAMPLE_RATE / len(ids)
            spans.append(
                CTCDecodedSpan(
                    text,
                    start / TARGET_SAMPLE_RATE + first * frame_seconds,
                    start / TARGET_SAMPLE_RATE + last * frame_seconds,
                    float(confidence[first:last].mean()),
                )
            )
        return tuple(spans)


def _batched(values: tuple[int, ...], batch_size: int) -> Iterable[tuple[int, ...]]:
    iterator = iter(values)
    while batch := tuple(islice(iterator, batch_size)):
        yield batch


def _normalized_filler(text: str) -> str:
    normalized = normalize("NFKC", text).strip().strip(
        punctuation + TOKEN_EDGE_PUNCTUATION
    )
    if any(character.isspace() for character in normalized):
        return ""
    normalized = _normalize_common_filler_jamo(normalized)
    normalized = _compose_compatibility_jamo(normalized)
    return normalized


def _normalize_common_filler_jamo(text: str) -> str:
    replacements = (
        ("으ᄆ으ᄆ", "음음"),
        ("으ᄆ", "음"),
        ("ㅇㅏㅇㅏ", "아아"),
        ("ㅇㅓㅇㅓ", "어어"),
        ("ㅇㅡㅁㅇㅡㅁ", "음음"),
        ("ㅇㅏ", "아"),
        ("ㅇㅓ", "어"),
        ("ㅇㅡㅁ", "음"),
        ("ㄱㅡ", "그"),
        ("ㄱㅓ", "거"),
    )
    normalized = text
    for source, target in replacements:
        normalized = normalized.replace(source, target)
    return normalized


def _compose_compatibility_jamo(text: str) -> str:
    if not text:
        return text
    composed: list[str] = []
    pending_initial: str | None = None
    pending_medial: str | None = None
    pending_final: str | None = None
    for character in text:
        if character in _COMPATIBILITY_JAMO_INITIALS:
            if pending_initial is not None:
                if pending_medial is None:
                    composed.append(pending_initial)
                else:
                    composed.append(
                        _compose_syllable(
                            pending_initial,
                            pending_medial,
                            pending_final,
                        )
                    )
            pending_initial = character
            pending_medial = None
            pending_final = None
            continue
        if character in _COMPATIBILITY_JAMO_MEDIALS:
            if pending_initial is None:
                composed.append(character)
                continue
            if pending_medial is not None:
                composed.append(
                    _compose_syllable(
                        pending_initial,
                        pending_medial,
                        pending_final,
                    )
                )
                pending_initial = character
                pending_medial = None
                pending_final = None
                continue
            pending_medial = character
            pending_final = None
            continue
        if (
            pending_initial is not None
            and pending_medial is not None
            and character in _COMPATIBILITY_JAMO_FINALS
        ):
            pending_final = character
            continue
        if pending_initial is not None and pending_medial is not None:
            composed.append(
                _compose_syllable(pending_initial, pending_medial, pending_final)
            )
            pending_initial = None
            pending_medial = None
            pending_final = None
        elif pending_initial is not None:
            composed.append(pending_initial)
            pending_initial = None
        composed.append(character)
    if pending_initial is not None and pending_medial is not None:
        composed.append(
            _compose_syllable(pending_initial, pending_medial, pending_final)
        )
    elif pending_initial is not None:
        composed.append(pending_initial)
    return "".join(composed)


def _compose_syllable(
    initial: str, medial: str, final: str | None = None
) -> str:
    initial_index = _COMPATIBILITY_JAMO_INITIALS.index(initial)
    medial_index = _COMPATIBILITY_JAMO_MEDIALS.index(medial)
    final_index = 0 if final is None else _COMPATIBILITY_JAMO_FINALS.index(final) + 1
    return chr(0xAC00 + initial_index * 21 * 28 + medial_index * 28 + final_index)


_COMPATIBILITY_JAMO_INITIALS: Final = (
    "ㄱ",
    "ㄲ",
    "ㄴ",
    "ㄷ",
    "ㄸ",
    "ㄹ",
    "ㅁ",
    "ㅂ",
    "ㅃ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅉ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
)

_COMPATIBILITY_JAMO_MEDIALS: Final = (
    "ㅏ",
    "ㅐ",
    "ㅑ",
    "ㅒ",
    "ㅓ",
    "ㅔ",
    "ㅕ",
    "ㅖ",
    "ㅗ",
    "ㅘ",
    "ㅙ",
    "ㅚ",
    "ㅛ",
    "ㅜ",
    "ㅝ",
    "ㅞ",
    "ㅟ",
    "ㅠ",
    "ㅡ",
    "ㅢ",
    "ㅣ",
)

_COMPATIBILITY_JAMO_FINALS: Final = (
    "ㄱ",
    "ㄲ",
    "ㄳ",
    "ㄴ",
    "ㄵ",
    "ㄶ",
    "ㄷ",
    "ㄹ",
    "ㄺ",
    "ㄻ",
    "ㄼ",
    "ㄽ",
    "ㄾ",
    "ㄿ",
    "ㅀ",
    "ㅁ",
    "ㅂ",
    "ㅄ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
)
