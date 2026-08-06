package com.ssafy.b109.aivo.interview.dto;

public record AudioSttSegmentResponse(
        Double start,
        Double end,
        Long startTimeMs,
        Long endTimeMs,
        String text
) {
}
