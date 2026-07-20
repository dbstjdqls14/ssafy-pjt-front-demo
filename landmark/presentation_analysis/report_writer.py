from __future__ import annotations

from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

from presentation_analysis.models import (
    PresentationAnalysisResult,
    ReportPaths,
    SlideAlignment,
    SlideContent,
    SlideEvaluation,
    STTAnalysis,
    TimeRecommendation,
)
from presentation_analysis.text_utils import format_seconds


def write_reports(
    source_ppt: Path,
    slides: list[SlideContent],
    stt: STTAnalysis,
    alignments: list[SlideAlignment],
    recommendations: list[TimeRecommendation],
    evaluations: list[SlideEvaluation],
    target_duration_seconds: float | None,
    recommended_duration_seconds: float,
    buffer_seconds: float,
    alignment_note: str,
    logs_dir: Path,
) -> ReportPaths:
    logs_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ppt_xml = logs_dir / f"ppt_content_{stamp}.xml"
    analysis_xml = logs_dir / f"presentation_analysis_{stamp}.xml"
    analysis_txt = logs_dir / f"presentation_analysis_{stamp}.txt"

    _write_ppt_content_xml(ppt_xml, source_ppt, slides)
    _write_analysis_xml(
        analysis_xml,
        slides,
        stt,
        alignments,
        recommendations,
        evaluations,
        target_duration_seconds,
        recommended_duration_seconds,
        buffer_seconds,
        alignment_note,
    )
    _write_txt_report(
        analysis_txt,
        source_ppt,
        slides,
        stt,
        alignments,
        recommendations,
        evaluations,
        target_duration_seconds,
        recommended_duration_seconds,
        buffer_seconds,
        alignment_note,
    )
    return ReportPaths(str(ppt_xml), str(analysis_xml), str(analysis_txt))


def build_result(
    source_ppt: Path,
    slides: list[SlideContent],
    stt: STTAnalysis,
    alignments: list[SlideAlignment],
    recommendations: list[TimeRecommendation],
    evaluations: list[SlideEvaluation],
    target_duration_seconds: float | None,
    recommended_duration_seconds: float,
    buffer_seconds: float,
    report_paths: ReportPaths,
    alignment_note: str,
) -> PresentationAnalysisResult:
    return PresentationAnalysisResult(
        source_ppt=str(source_ppt),
        slides=slides,
        stt=stt,
        alignments=alignments,
        recommendations=recommendations,
        evaluations=evaluations,
        target_duration_seconds=target_duration_seconds,
        recommended_duration_seconds=recommended_duration_seconds,
        buffer_seconds=buffer_seconds,
        report_paths=report_paths,
        alignment_note=alignment_note,
    )


def _write_ppt_content_xml(path: Path, source_ppt: Path, slides: list[SlideContent]) -> None:
    root = ET.Element("presentation", {"source": source_ppt.name})
    for slide in slides:
        slide_el = ET.SubElement(root, "slide", {"index": str(slide.index)})
        ET.SubElement(slide_el, "title").text = slide.title

        content = ET.SubElement(slide_el, "content")
        ET.SubElement(content, "nativeText").text = slide.native_text
        ET.SubElement(content, "ocrText").text = slide.ocr_text
        ET.SubElement(content, "combinedText").text = slide.combined_text
        ET.SubElement(content, "speakerNotes").text = slide.speaker_notes

        metrics = ET.SubElement(slide_el, "metrics")
        _metric(metrics, "nativeTextCharCount", slide.native_text_char_count)
        _metric(metrics, "nativeTextNoSpaceCount", slide.native_text_no_space_count)
        _metric(metrics, "ocrTextCharCount", slide.ocr_text_char_count)
        _metric(metrics, "totalTextCharCount", slide.total_text_char_count)
        _metric(metrics, "totalTextNoSpaceCount", slide.total_text_no_space_count)
        _metric(metrics, "wordCount", slide.word_count)
        _metric(metrics, "lineCount", slide.line_count)
        _metric(metrics, "textBoxCount", slide.text_box_count)
        _metric(metrics, "imageCount", slide.image_count)
        _metric(metrics, "tableCount", slide.table_count)
        _metric(metrics, "tableRowCount", slide.table_row_count)
        _metric(metrics, "tableColumnCount", slide.table_column_count)
        _metric(metrics, "tableCellCount", slide.table_cell_count)
        _metric(metrics, "chartCount", slide.chart_count)
        _metric(metrics, "shapeCount", slide.shape_count)

        density = ET.SubElement(slide_el, "density")
        ET.SubElement(density, "score").text = str(slide.density_score)
        ET.SubElement(density, "level").text = slide.density_level

        if slide.extraction_warnings:
            warnings = ET.SubElement(slide_el, "warnings")
            for warning in slide.extraction_warnings:
                ET.SubElement(warnings, "warning").text = warning

    _write_xml(path, root)


def _write_analysis_xml(
    path: Path,
    slides: list[SlideContent],
    stt: STTAnalysis,
    alignments: list[SlideAlignment],
    recommendations: list[TimeRecommendation],
    evaluations: list[SlideEvaluation],
    target_duration_seconds: float | None,
    recommended_duration_seconds: float,
    buffer_seconds: float,
    alignment_note: str,
) -> None:
    root = ET.Element("presentationAnalysis")
    summary = ET.SubElement(root, "summary")
    _metric(summary, "targetDurationSeconds", round(target_duration_seconds or 0.0, 2))
    _metric(summary, "actualDurationSeconds", stt.total_duration)
    _metric(summary, "recommendedDurationSeconds", recommended_duration_seconds)
    _metric(summary, "bufferSeconds", buffer_seconds)
    _metric(summary, "presenterCharsPerSecond", stt.chars_per_second)
    _metric(summary, "speechDurationSeconds", stt.speech_duration)
    _metric(summary, "silenceDurationSeconds", stt.silence_duration)
    _metric(summary, "silenceRatio", stt.silence_ratio)
    _metric(summary, "longPauseCount", stt.long_pause_count)
    _metric(summary, "repetitionRatio", stt.repetition_ratio)
    ET.SubElement(summary, "alignmentNote").text = alignment_note
    ET.SubElement(summary, "speedNote").text = (
        "기본 휴리스틱 발화 속도를 사용했습니다." if stt.used_default_speed else "STT 세그먼트 기준 발화 속도입니다."
    )

    slides_el = ET.SubElement(root, "slides")
    alignment_by_index = {item.slide_index: item for item in alignments}
    recommendation_by_index = {item.slide_index: item for item in recommendations}
    evaluation_by_index = {item.slide_index: item for item in evaluations}
    for slide in slides:
        alignment = alignment_by_index[slide.index]
        recommendation = recommendation_by_index[slide.index]
        evaluation = evaluation_by_index[slide.index]

        slide_el = ET.SubElement(slides_el, "slide", {"index": str(slide.index)})
        ET.SubElement(slide_el, "title").text = slide.title
        ET.SubElement(slide_el, "slideType").text = recommendation.slide_type
        ET.SubElement(slide_el, "densityScore").text = str(slide.density_score)
        ET.SubElement(slide_el, "densityLevel").text = slide.density_level

        actual = ET.SubElement(slide_el, "actual")
        _metric(actual, "startSeconds", alignment.actual_start_time)
        _metric(actual, "endSeconds", alignment.actual_end_time)
        _metric(actual, "durationSeconds", alignment.actual_duration)
        _metric(actual, "alignmentConfidence", alignment.alignment_confidence)
        ET.SubElement(actual, "alignmentSource").text = alignment.source

        rec = ET.SubElement(slide_el, "recommendation")
        _metric(rec, "minimumSeconds", recommendation.minimum_seconds)
        _metric(rec, "recommendedSeconds", recommendation.recommended_seconds)
        _metric(rec, "maximumSeconds", recommendation.maximum_seconds)
        _metric(rec, "rawRecommendedSeconds", recommendation.raw_recommended_seconds)

        eval_el = ET.SubElement(slide_el, "evaluation")
        ET.SubElement(eval_el, "isTooLong").text = str(evaluation.is_too_long).lower()
        for reason in evaluation.reasons:
            ET.SubElement(eval_el, "reason").text = reason

        suggestions = ET.SubElement(slide_el, "suggestions")
        for suggestion in evaluation.suggestions:
            ET.SubElement(suggestions, "suggestion").text = suggestion

    _write_xml(path, root)


def _write_txt_report(
    path: Path,
    source_ppt: Path,
    slides: list[SlideContent],
    stt: STTAnalysis,
    alignments: list[SlideAlignment],
    recommendations: list[TimeRecommendation],
    evaluations: list[SlideEvaluation],
    target_duration_seconds: float | None,
    recommended_duration_seconds: float,
    buffer_seconds: float,
    alignment_note: str,
) -> None:
    alignment_by_index = {item.slide_index: item for item in alignments}
    recommendation_by_index = {item.slide_index: item for item in recommendations}
    evaluation_by_index = {item.slide_index: item for item in evaluations}
    long_candidates = [item for item in evaluations if item.is_too_long]

    lines: list[str] = []
    lines.append("=" * 60)
    lines.append("발표 슬라이드 시간 분석 결과")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"PPT 파일: {source_ppt.name}")
    lines.append(f"목표 발표시간: {format_seconds(target_duration_seconds or 0.0) if target_duration_seconds else '미지정'}")
    lines.append(f"실제 발표시간: {format_seconds(stt.total_duration)}")
    lines.append(f"권장 발표시간 합계: {format_seconds(recommended_duration_seconds)}")
    lines.append(f"예비시간: {format_seconds(buffer_seconds)}")
    lines.append(f"분석 슬라이드 수: {len(slides)}장")
    lines.append(f"평균 발화 속도: 초당 {stt.chars_per_second:.2f}자")
    if stt.used_default_speed:
        lines.append("발화 속도 기준: 기본 휴리스틱 값")
    lines.append(f"긴 슬라이드 후보: {len(long_candidates)}장")
    lines.append(f"슬라이드 매칭 방식: {alignment_note}")
    lines.append("콘텐츠 밀도 점수는 발표 품질 점수가 아니라 콘텐츠 양 비교용 휴리스틱입니다.")
    if "추정" in alignment_note:
        lines.append("슬라이드 자동 매칭은 실제 전환 로그가 아닌 추정값입니다.")
    for warning in stt.warnings:
        lines.append(f"STT 경고: {warning}")
    lines.append("")

    for slide in slides:
        alignment = alignment_by_index[slide.index]
        recommendation = recommendation_by_index[slide.index]
        evaluation = evaluation_by_index[slide.index]
        lines.append("-" * 60)
        lines.append(f"[슬라이드 {slide.index}] {slide.title}")
        lines.append("-" * 60)
        lines.append(f"유형: {recommendation.slide_type}")
        lines.append(f"콘텐츠 밀도: {slide.density_score} / {slide.density_level}")
        lines.append(f"실제 발표시간: {format_seconds(alignment.actual_duration)}")
        lines.append(
            "권장 발표시간: "
            f"{recommendation.minimum_seconds:.0f}~{recommendation.maximum_seconds:.0f}초 "
            f"(기준 {recommendation.recommended_seconds:.0f}초)"
        )
        lines.append(f"초과시간: {evaluation.overrun_seconds:.0f}초")
        lines.append(f"슬라이드 매칭 신뢰도: {alignment.alignment_confidence:.2f}")
        lines.append("")
        lines.append("판정:")
        if evaluation.reasons:
            lines.extend(f"- {reason}" for reason in evaluation.reasons)
        else:
            lines.append("- 긴 슬라이드 후보가 아닙니다.")
        lines.append("")
        lines.append("개선 방향:")
        if evaluation.suggestions:
            lines.extend(f"{idx}. {suggestion}" for idx, suggestion in enumerate(evaluation.suggestions, start=1))
        else:
            lines.append("1. 현재 기준에서 별도 개선 제안이 없습니다.")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def _metric(parent: ET.Element, name: str, value: object) -> None:
    ET.SubElement(parent, name).text = str(value)


def _write_xml(path: Path, root: ET.Element) -> None:
    ET.indent(root, space="    ")
    tree = ET.ElementTree(root)
    tree.write(path, encoding="utf-8", xml_declaration=True)
