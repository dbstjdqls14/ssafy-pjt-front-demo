package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record InterviewStartResponse(
        Long interviewId,
        Long practiceId,
        Long interviewerId,
        List<String> questions,
        List<InterviewQuestionItemResponse> questionItems
) {
}
