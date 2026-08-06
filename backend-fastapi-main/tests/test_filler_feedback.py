from app.domains.audio_analysis.filler_model import _feedback


def test_feedback_uses_interjection_terminology() -> None:
    assert _feedback(3, 0, 0) == "추임새가 3회 감지되었습니다."


def test_empty_feedback_uses_interjection_terminology() -> None:
    assert _feedback(0, 0, 0) == "추임새, 침묵, 반복/말더듬 후보가 감지되지 않았습니다."
