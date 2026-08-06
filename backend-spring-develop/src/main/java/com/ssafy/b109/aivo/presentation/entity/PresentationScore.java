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
@Table(name = "presentation_scores")
@Getter
@Setter
public class PresentationScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "total_feedback_id", nullable = false)
    private Long totalFeedbackId;

    @Column(name = "content_relevance", nullable = false)
    private Short contentRelevance;

    @Column(name = "delivery", nullable = false)
    private Short delivery;

    @Column(name = "nonverbal", nullable = false)
    private Short nonverbal;

    @Column(name = "question_answer")
    private Short questionAnswer;
}
