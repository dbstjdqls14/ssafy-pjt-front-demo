import asyncio
from typing import Any

from app.messaging.contracts import (
    AudienceQuestionRequestPayload,
    FeedbackRequestPayload,
    ReportRequestPayload,
)


class LlmTaskService:
    def load_models(self) -> None:
        # TODO: 실제 LLM client, prompt template, retriever 등 리소스는 시작 시 여기서 초기화한다.
        return None

    async def handle_audience_question(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = AudienceQuestionRequestPayload.model_validate(payload)
        return await asyncio.to_thread(self._run_audience_question_generation, request)

    async def handle_feedback(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = FeedbackRequestPayload.model_validate(payload)
        return await asyncio.to_thread(self._run_feedback_generation, request)

    async def handle_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = ReportRequestPayload.model_validate(payload)
        return await asyncio.to_thread(self._run_report_generation, request)

    def _run_audience_question_generation(
        self,
        request: AudienceQuestionRequestPayload,
    ) -> dict[str, Any]:
        # TODO: transcriptUrl/slideContentUrl 기반 실제 LLM 질문 생성으로 교체한다.
        return {
            "presentationId": request.presentationId,
            "questions": [
                {
                    "question": "이 기술을 실제 서비스에 어떻게 적용할 수 있나요?",
                    "category": "APPLICATION",
                }
            ][: request.questionCount],
            "processingTimeMs": 100,
        }

    def _run_feedback_generation(self, request: FeedbackRequestPayload) -> dict[str, Any]:
        # TODO: STT, 음성/시각 분석 결과 기반 실제 LLM 피드백 생성으로 교체한다.
        return {
            "presentationId": request.presentationId,
            "summary": "발표 흐름은 명확하지만 결론의 근거가 부족합니다.",
            "strengths": [
                "발표 구조가 명확합니다.",
            ],
            "improvements": [
                "결론에 정량적 근거를 추가하세요.",
            ],
            "processingTimeMs": 100,
        }

    def _run_report_generation(self, request: ReportRequestPayload) -> dict[str, Any]:
        # TODO: analysisResultUrls를 취합해 실제 리포트 파일 생성/업로드로 교체한다.
        return {
            "presentationId": request.presentationId,
            "reportUrl": f"s3://aivo-results/reports/{request.presentationId}.json",
            "processingTimeMs": 100,
        }
