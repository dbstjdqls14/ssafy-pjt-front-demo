package com.ssafy.b109.aivo.feedback.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "total_feedbacks")
@Getter
@Setter
public class TotalFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "practice_id", nullable = false)
    private Long practiceId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "nonverbal_feedback", columnDefinition = "json")
    private String nonverbalFeedback;

    @Column(name = "speech_speed", nullable = false)
    private Long speechSpeed;
}
