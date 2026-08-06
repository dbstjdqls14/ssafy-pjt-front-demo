package com.ssafy.b109.aivo.presentation.dto;

public record PresentationQuestionFeedbackResponse(
        Long id,
        Long questionId,
        Short score,
        String content
) {
}
