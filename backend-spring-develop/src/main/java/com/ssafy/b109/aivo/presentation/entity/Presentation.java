package com.ssafy.b109.aivo.presentation.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;


import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "presentations")

public class Presentation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "temporary_file_key", length = 500)
    private String temporaryFileKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "processing_status", nullable = false, length = 20)
    private PresentationProcessingStatus processingStatus;

    @Column(name = "target_duration_sec", nullable = false)
    private Long targetDurationSec;

    @Column(name = "ai_qna_enabled", nullable = false)
    private boolean aiQnaEnabled;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static Presentation create(Long targetDurationSec, boolean aiQnaEnabled) {
        Presentation presentation = new Presentation();
        presentation.targetDurationSec = targetDurationSec;
        presentation.aiQnaEnabled = aiQnaEnabled;
        presentation.processingStatus =
                PresentationProcessingStatus.PENDING;
        presentation.createdAt = LocalDateTime.now();
        return presentation;
    }

    public void startProcessing() {
        this.processingStatus =
                PresentationProcessingStatus.PROCESSING;
    }

    public void startAnalyzing() {
        this.processingStatus =
                PresentationProcessingStatus.ANALYZING;
    }

    public void complete() {
        this.processingStatus =
                PresentationProcessingStatus.COMPLETED;
    }

    public void fail() {
        this.processingStatus =
                PresentationProcessingStatus.FAILED;
    }

    public boolean isCompleted() {
        return processingStatus == PresentationProcessingStatus.COMPLETED;
    }

    public void updateTemporaryFileKey(String key) {
        this.temporaryFileKey = key;
    }

    public void clearTemporaryFileKey() { this.temporaryFileKey = null; }

    public boolean isProcessingInProgress() {
        return processingStatus == PresentationProcessingStatus.PENDING ||
                processingStatus == PresentationProcessingStatus.PROCESSING ||
                processingStatus == PresentationProcessingStatus.ANALYZING;
    }
}

