package com.ssafy.b109.aivo.interview.dto;

public record AudioAnalysisResult(
        Integer fillerCount,
        Boolean silenceDetected,
        Boolean stutterDetected,
        Integer silenceDurationMs,
        Integer averageWpm,
        String feedback
) {
}
