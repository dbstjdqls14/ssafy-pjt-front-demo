package com.ssafy.b109.aivo.practice.entity;

import com.ssafy.b109.aivo.interview.entity.Interview;
import com.ssafy.b109.aivo.presentation.entity.Presentation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "practices")
@Getter
@Setter
public class Practice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id", nullable = false, foreignKey = @ForeignKey(name = "fk_practices_folder"))
    private PracticeFolder folder;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_session_id", foreignKey = @ForeignKey(name = "fk_practices_interview_session"))
    private Interview interviewSession;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "presentation_id", foreignKey = @ForeignKey(name = "fk_practices_presentation"))
    private Presentation presentation;

    @Column(name = "title", nullable = false, length = 128)
    private String title;

    @Column(name = "description", nullable = false, length = 500)
    private String description;

    @Column(name = "duration_sec", nullable = false)
    private Long durationSec;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
