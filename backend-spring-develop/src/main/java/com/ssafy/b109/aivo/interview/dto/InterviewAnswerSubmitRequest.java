package com.ssafy.b109.aivo.interview.dto;

public record InterviewAnswerSubmitRequest(
        Long questionId,
        String question,
        String answer,
        Long startTimeMs,
        Long endTimeMs,
        Long startTime,
        Long endTime
) {
    public InterviewAnswerSubmitRequest(Long questionId, String question, String answer) {
        this(questionId, question, answer, null, null, null, null);
    }

    public InterviewAnswerSubmitRequest(
            Long questionId,
            String question,
            String answer,
            Long startTimeMs,
            Long endTimeMs
    ) {
        this(questionId, question, answer, startTimeMs, endTimeMs, null, null);
    }

    @Override
    public Long startTimeMs() {
        return startTimeMs != null ? startTimeMs : secondsToMs(startTime);
    }

    @Override
    public Long endTimeMs() {
        return endTimeMs != null ? endTimeMs : secondsToMs(endTime);
    }

    private static Long secondsToMs(Long seconds) {
        return seconds == null ? null : seconds * 1000L;
    }
}
