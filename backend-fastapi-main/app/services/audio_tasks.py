import asyncio
from typing import Any

from app.messaging.contracts import (
    AudioAnalysisRequestPayload,
    PronunciationAnalysisRequestPayload,
    SttRequestPayload,
    VoiceAnalysisRequestPayload,
)


class AudioTaskService:
    def load_models(self) -> None:
        # TODO: 실제 faster-whisper 모델과 음성 분석 모델은 Worker 시작 시 여기서 한 번만 로드한다.
        return None

    async def handle_audio_analysis(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = AudioAnalysisRequestPayload.model_validate(payload)
        return await asyncio.to_thread(self._run_audio_analysis, request)

    async def handle_stt(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = SttRequestPayload.model_validate(payload)
        return await asyncio.to_thread(self._run_stt, request)

    async def handle_voice_analysis(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = VoiceAnalysisRequestPayload.model_validate(payload)
        return await asyncio.to_thread(self._run_voice_analysis, request)

    async def handle_pronunciation_analysis(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = PronunciationAnalysisRequestPayload.model_validate(payload)
        return await asyncio.to_thread(self._run_pronunciation_analysis, request)

    def _run_stt(self, request: SttRequestPayload) -> dict[str, Any]:
        # TODO: request.audioUrl 다운로드 후 faster-whisper STT 실행으로 교체한다.
        return {
            "presentationId": request.presentationId,
            "transcript": "테스트 STT 결과입니다.",
            "segments": [],
            "processingTimeMs": 100,
        }

    def _run_audio_analysis(self, request: AudioAnalysisRequestPayload) -> dict[str, Any]:
        return {
            "interviewId": request.interviewId,
            "practiceId": request.practiceId,
            "sequence": request.sequence,
            "fillerCount": 2,
            "silenceDetected": False,
            "stutterDetected": False,
            "silenceDurationMs": 0,
            "averageWpm": 128,
            "feedback": "추임새가 약간 감지되었습니다. 답변 속도는 안정적인 편입니다.",
            "processingTimeMs": 100,
        }

    def _run_voice_analysis(self, request: VoiceAnalysisRequestPayload) -> dict[str, Any]:
        # TODO: 실제 음성 속도/톤/무음 구간 분석으로 교체한다.
        return {
            "presentationId": request.presentationId,
            "speakingRate": "NORMAL",
            "volumeStability": "STABLE",
            "pauseCount": 0,
            "processingTimeMs": 100,
        }

    def _run_pronunciation_analysis(
        self,
        request: PronunciationAnalysisRequestPayload,
    ) -> dict[str, Any]:
        # TODO: 실제 발음 정확도 분석 모델 호출로 교체한다.
        return {
            "presentationId": request.presentationId,
            "language": request.language,
            "pronunciationScore": 90,
            "issues": [],
            "processingTimeMs": 100,
        }
