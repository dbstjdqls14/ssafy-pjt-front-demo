package com.ssafy.b109.aivo.interview.entity;

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
@Table(name = "interview_scores")
@Getter
@Setter
public class InterviewScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "total_feedback_id", nullable = false)
    private Long totalFeedbackId;

    @Column(name = "overall_score")
    private Short overallScore;

    @Column(name = "voice_score")
    private Short voiceScore;

    @Column(name = "video_score")
    private Short videoScore;

    @Column(name = "content_score")
    private Short contentScore;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
