package com.ssafy.b109.aivo.interview.dto;

import com.ssafy.b109.aivo.interview.entity.InterviewQuestion;

public record InterviewQuestionItemResponse(Long questionId, String question) {

    public static InterviewQuestionItemResponse from(InterviewQuestion interviewQuestion) {
        return new InterviewQuestionItemResponse(
                interviewQuestion.getId(),
                interviewQuestion.getQuestion()
        );
    }
}
