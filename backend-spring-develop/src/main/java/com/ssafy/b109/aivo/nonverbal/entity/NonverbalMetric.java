package com.ssafy.b109.aivo.nonverbal.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "nonverbal_metrics")
@Getter
@Setter
public class NonverbalMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "practice_id", nullable = false)
    private Long practiceId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
