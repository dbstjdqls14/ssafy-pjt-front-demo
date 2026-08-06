package com.ssafy.b109.aivo.speech.entity;

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
@Table(name = "speech_metrics")
@Getter
@Setter
public class SpeechMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "practice_id", nullable = false)
    private Long practiceId;

    @Column(name = "speech_duration_ms", nullable = false)
    private Long speechDurationMs;

    @Column(name = "average_wpm")
    private Float averageWpm;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
