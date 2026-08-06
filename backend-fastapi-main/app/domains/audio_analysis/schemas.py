from pydantic import BaseModel, Field


class AudioAnalysisResponse(BaseModel):
    interviewId: int
    sequence: int | None = None
    filename: str | None = None
    contentType: str | None = None
    size: int
    fillerCount: int = Field(ge=0)
    silenceDetected: bool
    stutterDetected: bool
    silenceDurationMs: int = Field(ge=0)
    averageWpm: int = Field(ge=0)
    feedback: str

class AudioPracticeAnalysisResponse(BaseModel):
    practiceId: int
    sequence: int | None = None
    filename: str | None = None
    contentType: str | None = None
    size: int
    fillerCount: int = Field(ge=0)
    silenceDetected: bool
    stutterDetected: bool
    silenceDurationMs: int = Field(ge=0)
    averageWpm: int = Field(ge=0)
    feedback: str


class AudioSttSegment(BaseModel):
    start: float
    end: float
    startTimeMs: int
    endTimeMs: int
    text: str


class FullAudioSttResponse(BaseModel):
    interviewId: int
    filename: str | None = None
    transcript: str
    segments: list[AudioSttSegment]
    processingTimeMs: int = Field(ge=0)
