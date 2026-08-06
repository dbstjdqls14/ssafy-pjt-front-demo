package com.ssafy.b109.aivo.interview.dto;

public record QuestionVideoSegmentResponse(
        String kind,
        String label,
        String time,
        Integer startTimeSeconds,
        Integer endTimeSeconds,
        Integer absoluteTimeSeconds,
        String feedback
) {
}
