from __future__ import annotations

from dataclasses import replace

from presentation_analysis.config import AnalysisConfig
from presentation_analysis.models import SlideContent, TimeRecommendation


IMPORTANT_TYPES = {
    "문제 정의",
    "서비스 소개",
    "사용자 흐름",
    "핵심 기능",
    "기술 구조",
    "AI 적용",
    "구현 방법",
    "차별점",
}


def build_recommendations(
    slides: list[SlideContent],
    presenter_chars_per_second: float,
    config: AnalysisConfig,
    target_minutes: float | None = None,
) -> tuple[list[TimeRecommendation], float, float | None]:
    recommendations = [recommend_slide_time(slide, presenter_chars_per_second, config) for slide in slides]
    target_seconds = target_minutes * 60.0 if target_minutes and target_minutes > 0 else None
    if target_seconds is not None:
        recommendations = _scale_to_target(recommendations, slides, target_seconds, config)
    total_recommended = round(sum(item.recommended_seconds for item in recommendations), 2)
    buffer_seconds = round(max(0.0, target_seconds - total_recommended), 2) if target_seconds is not None else 0.0
    return recommendations, total_recommended, buffer_seconds


def recommend_slide_time(
    slide: SlideContent,
    presenter_chars_per_second: float,
    config: AnalysisConfig,
) -> TimeRecommendation:
    slide.slide_type = detect_slide_type(slide)
    rate = max(0.1, presenter_chars_per_second or config.default_chars_per_second)
    rec_config = config.recommendation

    text_seconds = (slide.total_text_char_count / rate) * rec_config.text_time_ratio
    image_seconds = min(slide.image_count, rec_config.max_image_count_for_time) * rec_config.image_seconds
    table_seconds = slide.table_count * rec_config.table_seconds
    chart_seconds = slide.chart_count * rec_config.chart_seconds
    density_bonus = rec_config.density_bonus_seconds.get(slide.density_level, 0.0)

    raw = rec_config.base_seconds + text_seconds + image_seconds + table_seconds + chart_seconds + density_bonus
    minimum, recommended, maximum = _range_for_slide(raw, slide.slide_type, config)
    return TimeRecommendation(
        slide_index=slide.index,
        slide_type=slide.slide_type,
        minimum_seconds=minimum,
        recommended_seconds=recommended,
        maximum_seconds=maximum,
        raw_recommended_seconds=round(raw, 2),
    )


def detect_slide_type(slide: SlideContent) -> str:
    title = slide.title.lower()
    text = f"{slide.title}\n{slide.combined_text}".lower()

    if slide.index == 1 and slide.total_text_char_count <= 180:
        return "표지"
    if any(keyword in text for keyword in ("목차", "agenda", "contents", "순서")):
        return "목차"
    if any(keyword in text for keyword in ("문제", "불편", "pain point", "problem")):
        return "문제 정의"
    if any(keyword in text for keyword in ("시장", "조사", "경쟁", "market")):
        return "시장 조사"
    if any(keyword in text for keyword in ("서비스", "솔루션", "소개")):
        return "서비스 소개"
    if any(keyword in text for keyword in ("사용자 흐름", "user flow", "플로우", "journey")):
        return "사용자 흐름"
    if any(keyword in text for keyword in ("핵심 기능", "주요 기능", "feature")):
        return "핵심 기능"
    if any(keyword in text for keyword in ("아키텍처", "기술 구조", "architecture", "시스템 구조")):
        return "기술 구조"
    if any(keyword in text for keyword in ("ai", "인공지능", "모델", "machine learning", "ml")):
        return "AI 적용"
    if any(keyword in text for keyword in ("위험", "리스크", "risk")):
        return "위험요소"
    if any(keyword in text for keyword in ("일정", "로드맵", "timeline", "plan")):
        return "일정"
    if any(keyword in text for keyword in ("기대효과", "효과", "impact")):
        return "기대효과"
    if any(keyword in text for keyword in ("차별", "경쟁력", "different")):
        return "차별점"
    if any(keyword in title for keyword in ("결론", "마무리", "감사", "thank")):
        return "결론"
    return "일반 슬라이드"


def _range_for_slide(raw: float, slide_type: str, config: AnalysisConfig) -> tuple[float, float, float]:
    rec_config = config.recommendation
    if slide_type in {"표지", "목차"}:
        recommended = _clamp(raw, rec_config.transition_min_seconds, rec_config.transition_max_seconds)
        minimum = _clamp(recommended * (1.0 - rec_config.range_ratio), rec_config.transition_min_seconds, rec_config.transition_max_seconds)
        maximum = _clamp(recommended * (1.0 + rec_config.range_ratio), rec_config.transition_min_seconds, rec_config.transition_max_seconds)
    else:
        recommended = _clamp(raw, rec_config.min_seconds, rec_config.max_seconds)
        minimum = _clamp(recommended * (1.0 - rec_config.range_ratio), rec_config.min_seconds, rec_config.max_seconds)
        maximum = _clamp(recommended * (1.0 + rec_config.range_ratio), rec_config.min_seconds, rec_config.max_seconds)
    return round(minimum, 2), round(recommended, 2), round(maximum, 2)


def _scale_to_target(
    recommendations: list[TimeRecommendation],
    slides: list[SlideContent],
    target_seconds: float,
    config: AnalysisConfig,
) -> list[TimeRecommendation]:
    budget = target_seconds * (1.0 - config.target_buffer_ratio)
    if budget <= 0 or not recommendations:
        return recommendations

    weighted_values: list[float] = []
    for recommendation, slide in zip(recommendations, slides):
        multiplier = 1.0
        if recommendation.slide_type in IMPORTANT_TYPES:
            multiplier += 0.2
        if recommendation.slide_type in {"표지", "목차"}:
            multiplier -= 0.25
        multiplier += min(slide.density_score / 100.0, 1.0) * 0.15
        weighted_values.append(max(1.0, recommendation.recommended_seconds * multiplier))

    total_weight = sum(weighted_values)
    if total_weight <= 0:
        return recommendations

    scaled: list[TimeRecommendation] = []
    for recommendation, weight in zip(recommendations, weighted_values):
        target_value = budget * (weight / total_weight)
        minimum, recommended, maximum = _range_for_slide(target_value, recommendation.slide_type, config)
        scaled.append(
            replace(
                recommendation,
                minimum_seconds=minimum,
                recommended_seconds=recommended,
                maximum_seconds=maximum,
            )
        )
    return scaled


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))
