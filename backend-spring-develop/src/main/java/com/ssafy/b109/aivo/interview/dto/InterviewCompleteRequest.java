package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record InterviewCompleteRequest(
        Long durationSec,
        List<InterviewAnswerSubmitRequest> answers,
        InterviewNonverbalRequest nonverbal
) {
}
