package com.ssafy.b109.aivo.interview.dto;

public record InterviewMetricItemResponse(
        String key,
        String label,
        String value,
        Integer count,
        String unit
) {
}
