package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record QuestionEvaluationResponse(
        Long questionId,
        String question,
        String answer,
        Integer score,
        String feedback,
        String improvement,
        String problem,
        String issueLabel,
        Integer startTimeSeconds,
        Integer endTimeSeconds,
        Integer durationSeconds,
        List<QuestionVideoSegmentResponse> segments,
        QuestionVoicePaceResponse voicePace,
        QuestionGestureSeriesResponse gestureSeries
) {
    public QuestionEvaluationResponse(
            Long questionId,
            String question,
            String answer,
            Integer score,
            String feedback,
            String improvement,
            String problem,
            String issueLabel,
            Integer startTimeSeconds,
            Integer endTimeSeconds,
            Integer durationSeconds,
            List<QuestionVideoSegmentResponse> segments,
            QuestionVoicePaceResponse voicePace
    ) {
        this(
                questionId,
                question,
                answer,
                score,
                feedback,
                improvement,
                problem,
                issueLabel,
                startTimeSeconds,
                endTimeSeconds,
                durationSeconds,
                segments,
                voicePace,
                null
        );
    }
}
