from fastapi import APIRouter, File, Query, UploadFile

from app.domains.audio_analysis.schemas import (
    AudioAnalysisResponse,
    AudioPracticeAnalysisResponse,
    FullAudioSttResponse,
)
from app.domains.audio_analysis.service import AudioAnalysisService

router = APIRouter(prefix="/api/v1/interviews", tags=["audio-analysis"])
practice_router = APIRouter(prefix="/api/v1/practices", tags=["audio-analysis"])
service = AudioAnalysisService()


@router.post(
    "/{interview_id}/audio-analysis",
    response_model=AudioAnalysisResponse,
)
async def analyze_interview_audio(
    interview_id: int,
    audio: UploadFile = File(...),
    sequence: int | None = Query(default=None, ge=0),
) -> AudioAnalysisResponse:
    return await service.analyze_chunk(interview_id, audio, sequence)

@practice_router.post(
    "/{practice_id}/audio-analysis",
    response_model=AudioPracticeAnalysisResponse,
)
async def analyze_practice_audio(
    practice_id: int,
    audio: UploadFile = File(...),
    sequence: int | None = Query(default=None, ge=0),
) -> AudioPracticeAnalysisResponse:
    return await service.analyze_practice_chunk(practice_id, audio, sequence)


@router.post(
    "/{interview_id}/stt",
    response_model=FullAudioSttResponse,
)
async def transcribe_interview_audio(
    interview_id: int,
    audio: UploadFile = File(...),
) -> FullAudioSttResponse:
    return await service.transcribe_full_audio(interview_id, audio)
