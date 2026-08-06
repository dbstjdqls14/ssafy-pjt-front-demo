package com.ssafy.b109.aivo.interview.dto;

public record InterviewScoreMetricsResponse(
        Integer voiceScore,
        Integer videoScore,
        Integer contentScore
) {
}
