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
@Table(name = "presentation_questions")
@Getter
@Setter
public class PresentationQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "presentation_id", nullable = false)
    private Long presentationId;

    @Column(name = "question", nullable = false)
    private String question;

    @Column(name = "model_answer", nullable = false)
    private String modelAnswer;

    @Column(name = "user_answer")
    private String userAnswer;
}
