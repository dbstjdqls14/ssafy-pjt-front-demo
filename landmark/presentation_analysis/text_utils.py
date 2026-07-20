from __future__ import annotations

import re
from collections import Counter


WORD_PATTERN = re.compile(r"[0-9A-Za-z가-힣]+")


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def no_space_len(text: str) -> int:
    return len(re.sub(r"\s+", "", text))


def count_words(text: str) -> int:
    return len(WORD_PATTERN.findall(text))


def split_nonempty_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def unique_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        cleaned = normalize_space(item)
        if not cleaned:
            continue
        key = re.sub(r"\s+", "", cleaned).lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(cleaned)
    return result


def merge_native_and_ocr(native_text: str, ocr_text: str) -> tuple[str, str]:
    native_key = re.sub(r"\s+", "", native_text).lower()
    kept_ocr_lines: list[str] = []
    for line in split_nonempty_lines(ocr_text):
        key = re.sub(r"\s+", "", line).lower()
        if not key or key in native_key:
            continue
        kept_ocr_lines.append(line)
    filtered_ocr = "\n".join(unique_preserve_order(kept_ocr_lines))
    parts = [part for part in [native_text.strip(), filtered_ocr.strip()] if part]
    return filtered_ocr, "\n".join(parts)


def repetition_ratio(text: str) -> float:
    tokens = WORD_PATTERN.findall(text.lower())
    if len(tokens) < 6:
        return 0.0

    ngrams: list[tuple[str, ...]] = []
    for n in (2, 3):
        ngrams.extend(tuple(tokens[i : i + n]) for i in range(0, len(tokens) - n + 1))
    if not ngrams:
        return 0.0

    counts = Counter(ngrams)
    repeated = sum(count - 1 for count in counts.values() if count > 1)
    return round(repeated / len(ngrams), 3)


def format_seconds(seconds: float) -> str:
    seconds = max(0.0, seconds)
    minutes = int(seconds // 60)
    rest = int(round(seconds - minutes * 60))
    if rest == 60:
        minutes += 1
        rest = 0
    if minutes:
        return f"{minutes}분 {rest:02d}초"
    return f"{rest}초"
