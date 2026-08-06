package com.ssafy.b109.aivo.interview.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "interviewer_questions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_interviewer_questions_interviewer_order",
                columnNames = {"interviewer_id", "display_order"}
        )
)
@Getter
@Setter
public class InterviewerQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interviewer_id", nullable = false, foreignKey = @ForeignKey(name = "fk_interviewer_questions_interviewer"))
    private Interviewer interviewer;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "content", nullable = false, length = 300)
    private String content;

    @Column(name = "keywords", nullable = false, length = 100)
    private String keywords;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
