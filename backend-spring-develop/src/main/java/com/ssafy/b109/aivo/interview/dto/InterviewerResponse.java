package com.ssafy.b109.aivo.interview.dto;

import com.ssafy.b109.aivo.interview.entity.Interviewer;

import java.util.List;

public record InterviewerResponse(Long id, String code, String name, String description, String profileImageUrl, List<InterviewerQuestionResponse> questions) {
    public static InterviewerResponse of(Interviewer i, List<InterviewerQuestionResponse> iq){
        return new InterviewerResponse(i.getId(), i.getCode(), i.getName(), i.getDescription(), i.getProfileImageUrl(), iq);
    }
}
