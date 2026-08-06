from fastapi.testclient import TestClient
import io
import wave

import app.domains.audio_analysis.service as audio_analysis_service
from app.server import create_app
from app.domains.audio_analysis.filler_model import FillerAnalysis


def test_audio_analysis_returns_metrics(monkeypatch) -> None:
    def fake_analyze_filler_audio(_):
        return FillerAnalysis(
            filler_count=3,
            silence_detected=True,
            stutter_detected=False,
            silence_duration_ms=500,
            average_wpm=120,
            feedback="추임새가 3회 감지되었습니다.",
        )

    monkeypatch.setattr(
        audio_analysis_service,
        "analyze_filler_audio",
        fake_analyze_filler_audio,
    )
    monkeypatch.setattr(
        audio_analysis_service,
        "convert_to_pcm_wav",
        lambda path: path,
    )
    client = TestClient(create_app())

    response = client.post(
        "/api/v1/interviews/10/audio-analysis?sequence=3",
        files={"audio": ("chunk.wav", make_wav_bytes(), "audio/wav")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["interviewId"] == 10
    assert body["sequence"] == 3
    assert body["fillerCount"] == 3
    assert body["silenceDetected"] is True
    assert body["stutterDetected"] is False
    assert body["silenceDurationMs"] == 500
    assert body["averageWpm"] == 120
    assert "transcript" not in body


def test_practice_audio_analysis_returns_metrics(monkeypatch) -> None:
    def fake_analyze_filler_audio(_):
        return FillerAnalysis(
            filler_count=3,
            silence_detected=True,
            stutter_detected=False,
            silence_duration_ms=500,
            average_wpm=120,
            feedback="?꾨윭媛 3??媛먯??섏뿀?듬땲??",
        )

    monkeypatch.setattr(
        audio_analysis_service,
        "analyze_filler_audio",
        fake_analyze_filler_audio,
    )
    monkeypatch.setattr(
        audio_analysis_service,
        "convert_to_pcm_wav",
        lambda path: path,
    )
    client = TestClient(create_app())

    response = client.post(
        "/api/v1/practices/10/audio-analysis?sequence=3",
        files={"audio": ("chunk.wav", make_wav_bytes(), "audio/wav")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["practiceId"] == 10
    assert body["sequence"] == 3
    assert body["fillerCount"] == 3
    assert body["silenceDetected"] is True
    assert body["stutterDetected"] is False
    assert body["silenceDurationMs"] == 500
    assert body["averageWpm"] == 120
    assert "interviewId" not in body
    assert "transcript" not in body


def make_wav_bytes() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16_000)
        wav.writeframes(b"\x00\x00" * 160)
    return buffer.getvalue()
