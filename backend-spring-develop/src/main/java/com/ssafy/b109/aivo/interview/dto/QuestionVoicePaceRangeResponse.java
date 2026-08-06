package com.ssafy.b109.aivo.interview.dto;

public record QuestionVoicePaceRangeResponse(
        Integer startSec,
        Integer endSec,
        Double pace
) {
}
