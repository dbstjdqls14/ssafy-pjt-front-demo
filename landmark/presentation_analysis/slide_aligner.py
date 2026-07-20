from __future__ import annotations

import csv
from pathlib import Path
from typing import Callable

from presentation_analysis.config import AnalysisConfig
from presentation_analysis.models import SlideAlignment, SlideContent, STTAnalysis, STTSegment

LogFn = Callable[[str], None]


def align_slides(
    slides: list[SlideContent],
    stt: STTAnalysis,
    config: AnalysisConfig,
    slide_events_path: Path | None = None,
    logger: LogFn | None = None,
) -> tuple[list[SlideAlignment], str]:
    if slide_events_path is not None and slide_events_path.exists():
        if logger:
            logger(f"[매칭] 슬라이드 전환 기록을 사용합니다: {slide_events_path}")
        return _align_with_events(slides, stt.segments, slide_events_path, config), "slide_events.csv 기반 실제 전환 시간"

    if not stt.segments:
        if logger:
            logger("[매칭] STT 세그먼트가 없어 슬라이드별 실제 시간을 계산하지 않습니다.")
        return [_empty_alignment(slide.index, "none") for slide in slides], "STT 세그먼트 없음"

    if logger:
        logger("[매칭] slide_events.csv가 없어 STT-슬라이드 텍스트 유사도로 전환 구간을 추정합니다.")
    return _align_by_similarity(slides, stt.segments, config), "STT-슬라이드 텍스트 유사도 기반 추정"


def _align_with_events(
    slides: list[SlideContent],
    segments: list[STTSegment],
    slide_events_path: Path,
    config: AnalysisConfig,
) -> list[SlideAlignment]:
    events: dict[int, tuple[float, float]] = {}
    with slide_events_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                slide_index = int(row["slide_index"])
                start = float(row["start_time"])
                end = float(row["end_time"])
            except (KeyError, TypeError, ValueError):
                continue
            events[slide_index] = (max(0.0, start), max(0.0, end))

    alignments: list[SlideAlignment] = []
    for slide in slides:
        start, end = events.get(slide.index, (0.0, 0.0))
        matched_segments = [segment for segment in segments if _overlaps(segment.start, segment.end, start, end)]
        text = "\n".join(segment.text for segment in matched_segments)
        silence_ratio, long_pauses = _silence_stats(matched_segments, start, end, config.long_pause_seconds)
        alignments.append(
            SlideAlignment(
                slide_index=slide.index,
                actual_start_time=round(start, 3),
                actual_end_time=round(end, 3),
                actual_duration=round(max(0.0, end - start), 3),
                matched_stt_text=text,
                alignment_confidence=1.0 if slide.index in events else 0.0,
                source="csv",
                long_pause_count=long_pauses,
                silence_ratio=silence_ratio,
            )
        )
    return alignments


def _align_by_similarity(
    slides: list[SlideContent],
    segments: list[STTSegment],
    config: AnalysisConfig,
) -> list[SlideAlignment]:
    similarity = _similarity_matrix(slides, segments)
    assignments = _monotonic_assignments(similarity)

    adjusted: list[int] = []
    for index, slide_index in enumerate(assignments):
        best_score = max(similarity[index]) if similarity[index] else 0.0
        if best_score < config.low_alignment_threshold and adjusted:
            adjusted.append(adjusted[-1])
        else:
            adjusted.append(slide_index)

    alignments: list[SlideAlignment] = []
    for slide_pos, slide in enumerate(slides):
        assigned_pairs = [
            (segment, similarity[segment_pos][slide_pos])
            for segment_pos, segment in enumerate(segments)
            if adjusted[segment_pos] == slide_pos
        ]
        if not assigned_pairs:
            alignments.append(_empty_alignment(slide.index, "estimated"))
            continue

        assigned_segments = [pair[0] for pair in assigned_pairs]
        scores = [pair[1] for pair in assigned_pairs]
        start = min(segment.start for segment in assigned_segments)
        end = max(segment.end for segment in assigned_segments)
        text = "\n".join(segment.text for segment in assigned_segments)
        confidence = round(sum(scores) / len(scores), 3) if scores else 0.0
        silence_ratio, long_pauses = _silence_stats(assigned_segments, start, end, config.long_pause_seconds)
        alignments.append(
            SlideAlignment(
                slide_index=slide.index,
                actual_start_time=round(start, 3),
                actual_end_time=round(end, 3),
                actual_duration=round(max(0.0, end - start), 3),
                matched_stt_text=text,
                alignment_confidence=confidence,
                source="estimated",
                long_pause_count=long_pauses,
                silence_ratio=silence_ratio,
            )
        )
    return alignments


def _similarity_matrix(slides: list[SlideContent], segments: list[STTSegment]) -> list[list[float]]:
    slide_texts = [f"{slide.title}\n{slide.combined_text}" for slide in slides]
    segment_windows = _segment_context_windows(segments)
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore
        from sklearn.metrics.pairwise import cosine_similarity  # type: ignore

        vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=1)
        matrix = vectorizer.fit_transform(slide_texts + segment_windows)
        slide_vectors = matrix[: len(slide_texts)]
        segment_vectors = matrix[len(slide_texts) :]
        scores = cosine_similarity(segment_vectors, slide_vectors)
        return [[round(float(value), 4) for value in row] for row in scores]
    except Exception:
        return [[_char_ngram_similarity(segment_text, slide_text) for slide_text in slide_texts] for segment_text in segment_windows]


def _segment_context_windows(segments: list[STTSegment]) -> list[str]:
    windows: list[str] = []
    for index, segment in enumerate(segments):
        parts = []
        if index > 0:
            parts.append(segments[index - 1].text)
        parts.append(segment.text)
        if index + 1 < len(segments):
            parts.append(segments[index + 1].text)
        windows.append(" ".join(parts))
    return windows


def _monotonic_assignments(similarity: list[list[float]]) -> list[int]:
    if not similarity:
        return []
    segment_count = len(similarity)
    slide_count = len(similarity[0])
    if slide_count == 0:
        return []

    transition_penalty = 0.03
    dp = [[float("-inf")] * slide_count for _ in range(segment_count)]
    prev = [[0] * slide_count for _ in range(segment_count)]

    for slide_idx in range(slide_count):
        dp[0][slide_idx] = similarity[0][slide_idx] - slide_idx * transition_penalty

    for segment_idx in range(1, segment_count):
        for slide_idx in range(slide_count):
            best_score = float("-inf")
            best_prev = 0
            for prev_slide_idx in range(slide_idx + 1):
                score = dp[segment_idx - 1][prev_slide_idx] - (slide_idx - prev_slide_idx) * transition_penalty
                if score > best_score:
                    best_score = score
                    best_prev = prev_slide_idx
            dp[segment_idx][slide_idx] = best_score + similarity[segment_idx][slide_idx]
            prev[segment_idx][slide_idx] = best_prev

    current = max(range(slide_count), key=lambda slide_idx: dp[-1][slide_idx])
    assignments = [0] * segment_count
    for segment_idx in range(segment_count - 1, -1, -1):
        assignments[segment_idx] = current
        current = prev[segment_idx][current]
    return assignments


def _char_ngram_similarity(left: str, right: str) -> float:
    left_set = _char_ngrams(left)
    right_set = _char_ngrams(right)
    if not left_set or not right_set:
        return 0.0
    return round(len(left_set & right_set) / len(left_set | right_set), 4)


def _char_ngrams(text: str) -> set[str]:
    compact = "".join(text.lower().split())
    grams: set[str] = set()
    for size in range(2, 6):
        grams.update(compact[index : index + size] for index in range(0, max(0, len(compact) - size + 1)))
    return grams


def _empty_alignment(slide_index: int, source: str) -> SlideAlignment:
    return SlideAlignment(
        slide_index=slide_index,
        actual_start_time=0.0,
        actual_end_time=0.0,
        actual_duration=0.0,
        matched_stt_text="",
        alignment_confidence=0.0,
        source=source,
    )


def _overlaps(start_a: float, end_a: float, start_b: float, end_b: float) -> bool:
    return max(start_a, start_b) < min(end_a, end_b)


def _silence_stats(
    segments: list[STTSegment],
    start: float,
    end: float,
    long_pause_seconds: float,
) -> tuple[float, int]:
    duration = max(0.0, end - start)
    if duration <= 0.0:
        return 0.0, 0

    ordered = sorted(segments, key=lambda segment: segment.start)
    speech_duration = sum(max(0.0, min(segment.end, end) - max(segment.start, start)) for segment in ordered)
    long_pauses = 0
    previous_end = start
    for segment in ordered:
        gap = max(0.0, segment.start - previous_end)
        if gap >= long_pause_seconds:
            long_pauses += 1
        previous_end = max(previous_end, segment.end)
    if end - previous_end >= long_pause_seconds:
        long_pauses += 1
    silence = max(0.0, duration - speech_duration)
    return round(silence / duration, 3), long_pauses
