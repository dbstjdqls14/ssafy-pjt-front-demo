package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record InterviewStartRequest(
        Long companyId,
        Long occupationId,
        Long jobId,
        String workExperience,
        String title,
        Long folderId,
        List<Long> portfolioIds,
        List<Long> resumeIds,
        Long interviewerId
) {
}
