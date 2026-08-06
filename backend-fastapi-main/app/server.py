from fastapi import FastAPI

from app.domains.audio_analysis.controller import (
    practice_router as practice_audio_analysis_router,
    router as audio_analysis_router,
)
from app.domains.stt.controller import router as stt_router
from app.domains.system.controller import router as system_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Aivo AI Server",
        version="0.1.0",
    )

    app.include_router(system_router)
    app.include_router(audio_analysis_router)
    app.include_router(practice_audio_analysis_router)
    app.include_router(stt_router)

    return app
