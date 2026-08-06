package com.ssafy.b109.aivo.practice.dto;

public record AudioAnalysisResponse(
        Long practiceId,
        Integer sequence,
        Integer fillerCount,
        Boolean silenceDetected,
        Boolean stutterDetected,
        Integer silenceDurationMs,
        Integer averageWpm,
        String feedback
) {
}
