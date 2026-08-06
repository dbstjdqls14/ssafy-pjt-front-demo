package com.ssafy.b109.aivo.interview.dto;

public record InterviewContentEvaluationResponse(
        Integer relevanceScore,
        Integer structureScore,
        Integer clarityScore,
        Integer deliveryScore,
        String feedback
) {
}
