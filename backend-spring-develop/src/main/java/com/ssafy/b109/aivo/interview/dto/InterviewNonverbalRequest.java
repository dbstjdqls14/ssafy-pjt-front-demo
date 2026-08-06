package com.ssafy.b109.aivo.interview.dto;

public record InterviewNonverbalRequest(
        Integer gazeDeviationCount,
        Integer postureTiltPercent,
        Integer sampleCount
) {
}
