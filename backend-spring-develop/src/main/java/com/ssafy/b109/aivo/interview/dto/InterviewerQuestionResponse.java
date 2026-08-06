package com.ssafy.b109.aivo.interview.dto;

import com.ssafy.b109.aivo.interview.entity.InterviewerQuestion;

public record InterviewerQuestionResponse(String content, String category, String keywords) {

    public static InterviewerQuestionResponse from(InterviewerQuestion iq){
        return new InterviewerQuestionResponse(iq.getContent(), iq.getCategory(), iq.getKeywords());
    }
}
