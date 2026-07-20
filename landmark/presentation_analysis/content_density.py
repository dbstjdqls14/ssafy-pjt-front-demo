from __future__ import annotations

from presentation_analysis.config import AnalysisConfig
from presentation_analysis.models import SlideContent


def apply_density(slides: list[SlideContent], config: AnalysisConfig) -> None:
    for slide in slides:
        slide.density_score = calculate_density_score(slide, config)
        slide.density_level = density_level(slide.density_score)


def calculate_density_score(slide: SlideContent, config: AnalysisConfig) -> float:
    density = config.density
    text_score = min(slide.total_text_char_count / density.text_char_full_score, 1.0) * density.text_score_weight
    structure_score = min(
        (slide.text_box_count + slide.line_count / 5.0) / density.structure_full_score,
        1.0,
    ) * density.structure_score_weight
    visual_score = min(
        (
            slide.image_count
            + slide.table_count * 2
            + slide.chart_count * 2
            + slide.table_cell_count / 20.0
        )
        / density.visual_full_score,
        1.0,
    ) * density.visual_score_weight
    complexity_score = min(
        (slide.shape_count + slide.table_count + slide.chart_count) / density.complexity_full_score,
        1.0,
    ) * density.complexity_score_weight

    return round(text_score + structure_score + visual_score + complexity_score, 2)


def density_level(score: float) -> str:
    if score < 30:
        return "낮음"
    if score < 60:
        return "보통"
    if score < 80:
        return "높음"
    return "매우 높음"
