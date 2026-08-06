package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record InterviewReportResponse(
        Long interviewId,
        Long practiceId,
        String title,
        Long durationSeconds,
        Integer overallScore,
        InterviewScoreMetricsResponse metrics,
        List<InterviewScoreSectionResponse> scoreCards,
        QuestionVoicePaceResponse voicePace,
        QuestionGestureSeriesResponse gestureSeries,
        NonverbalSummaryResponse nonverbalSummary,
        InterviewContentEvaluationResponse contentEvaluation,
        List<QuestionEvaluationResponse> questionEvaluations,
        List<QuestionEvaluationResponse> questions,
        InterviewVideoResponse video,
        String videoUrl,
        String recordingUrl,
        List<String> strengths,
        List<String> improvements,
        String detailedFeedback
) {
}
