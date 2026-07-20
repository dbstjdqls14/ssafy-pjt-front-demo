from __future__ import annotations

from statistics import median

from presentation_analysis.config import AnalysisConfig
from presentation_analysis.models import (
    SlideAlignment,
    SlideContent,
    SlideEvaluation,
    STTAnalysis,
    TimeRecommendation,
)
from presentation_analysis.text_utils import no_space_len, repetition_ratio


def evaluate_slides(
    slides: list[SlideContent],
    alignments: list[SlideAlignment],
    recommendations: list[TimeRecommendation],
    stt: STTAnalysis,
    config: AnalysisConfig,
) -> list[SlideEvaluation]:
    alignment_by_index = {item.slide_index: item for item in alignments}
    recommendation_by_index = {item.slide_index: item for item in recommendations}
    durations = [item.actual_duration for item in alignments if item.actual_duration > 0]
    median_duration = median(durations) if durations else 0.0

    evaluations: list[SlideEvaluation] = []
    for slide in slides:
        alignment = alignment_by_index.get(slide.index)
        recommendation = recommendation_by_index.get(slide.index)
        if alignment is None or recommendation is None:
            evaluations.append(SlideEvaluation(slide.index, False, [], [], 0.0))
            continue

        reasons = _long_slide_reasons(slide, alignment, recommendation, median_duration, config)
        suggestions = _suggestions(slide, alignment, recommendation, stt, config, bool(reasons))
        overrun = max(0.0, alignment.actual_duration - recommendation.maximum_seconds)
        evaluations.append(
            SlideEvaluation(
                slide_index=slide.index,
                is_too_long=bool(reasons),
                reasons=reasons,
                suggestions=suggestions,
                overrun_seconds=round(overrun, 2),
            )
        )
    return evaluations


def _long_slide_reasons(
    slide: SlideContent,
    alignment: SlideAlignment,
    recommendation: TimeRecommendation,
    median_duration: float,
    config: AnalysisConfig,
) -> list[str]:
    actual = alignment.actual_duration
    if actual <= 0:
        return []

    reasons: list[str] = []
    threshold = recommendation.maximum_seconds * config.recommendation_overrun_ratio
    if actual > threshold:
        percent = ((actual / max(recommendation.maximum_seconds, 0.001)) - 1.0) * 100.0
        reasons.append(f"권장 최대시간 {recommendation.maximum_seconds:.0f}초보다 {percent:.1f}% 오래 설명함")

    if actual > config.soft_long_slide_seconds and slide.density_level in {"낮음", "보통"}:
        reasons.append(f"{config.soft_long_slide_seconds:.0f}초를 넘었지만 콘텐츠 밀도는 {slide.density_level}입니다")

    if median_duration > 0 and actual > median_duration * config.median_overrun_ratio:
        ratio = actual / median_duration
        reasons.append(f"전체 슬라이드 실제시간 중앙값보다 {ratio:.1f}배 오래 설명함")

    if actual > config.absolute_long_slide_seconds:
        reasons.append(f"절대 기준 {config.absolute_long_slide_seconds:.0f}초를 초과함")

    return reasons


def _suggestions(
    slide: SlideContent,
    alignment: SlideAlignment,
    recommendation: TimeRecommendation,
    stt: STTAnalysis,
    config: AnalysisConfig,
    is_too_long: bool,
) -> list[str]:
    suggestions: list[str] = []
    actual = alignment.actual_duration

    if is_too_long and slide.density_level in {"높음", "매우 높음"}:
        suggestions.append("한 슬라이드에 여러 핵심 메시지가 포함되었을 가능성이 있습니다. 내용을 2개 이상의 슬라이드로 분리하는 것을 권장합니다.")

    if is_too_long and slide.density_level in {"낮음", "보통"}:
        suggestions.append("슬라이드 정보량에 비해 설명시간이 깁니다. 반복 설명, 사례 확장 또는 본론과 관계없는 발화를 줄여야 합니다.")

    if slide.table_count > 0 or slide.chart_count > 0:
        suggestions.append("표 또는 차트 전체를 설명하기보다 발표 목적과 관련된 핵심 수치만 강조하세요.")

    if slide.total_text_char_count >= 600:
        suggestions.append("슬라이드 문장을 그대로 읽지 말고 핵심 문장과 키워드만 남기세요.")

    if alignment.long_pause_count > 0 and alignment.silence_ratio >= config.high_silence_ratio:
        suggestions.append("슬라이드 전환 후 설명 시작이 지연되고 있습니다. 슬라이드별 첫 문장을 미리 정해 전환 구간을 연습하세요.")

    if repetition_ratio(alignment.matched_stt_text) >= 0.08 or stt.repetition_ratio >= 0.12:
        suggestions.append("같은 의미의 문장이 반복되고 있습니다. 슬라이드의 핵심 결론을 한 문장으로 정리하세요.")

    if actual > 0:
        slide_chars_per_second = no_space_len(alignment.matched_stt_text) / actual
        if slide_chars_per_second >= config.fast_chars_per_second:
            suggestions.append("짧은 시간에 설명량이 집중되어 있습니다. 핵심 용어 뒤에 짧은 간격을 두고, 문장을 더 짧게 구성하세요.")

    if is_too_long and not suggestions:
        suggestions.append("권장 시간을 넘긴 구간의 예시나 부연 설명을 줄이고 핵심 결론을 먼저 말하세요.")

    return suggestions[: config.max_suggestions_per_slide]
