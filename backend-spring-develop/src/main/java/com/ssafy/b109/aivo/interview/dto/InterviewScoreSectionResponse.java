package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record InterviewScoreSectionResponse(
        String key,
        String label,
        Integer score,
        List<InterviewMetricItemResponse> metrics
) {
}
