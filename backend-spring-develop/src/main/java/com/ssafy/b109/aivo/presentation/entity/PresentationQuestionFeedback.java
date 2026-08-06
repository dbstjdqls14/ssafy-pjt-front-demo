package com.ssafy.b109.aivo.presentation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "presentation_question_feedbacks")
@Getter
@Setter
public class PresentationQuestionFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "total_feedback_id", nullable = false)
    private Long totalFeedbackId;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(name = "score", nullable = false)
    private Short score;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;
}
