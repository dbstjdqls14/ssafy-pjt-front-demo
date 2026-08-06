package com.ssafy.b109.aivo.slide.entity;

import com.ssafy.b109.aivo.practice.entity.Practice;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "slide_click_logs")
@IdClass(SlideClickLogId.class)
@Getter
public class SlideClickLog {

    @Id
    @Column(name = "id", nullable = false)
    private Long id;

    @Id
    @Column(name = "practice_id")
    private Long practiceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "practice_id", insertable = false, updatable = false, foreignKey = @ForeignKey(name = "FK_practices_TO_slide_click_logs_1"))
    private Practice practice;

    @Column(name = "from_slide_id")
    private Long fromSlideId;

    @Column(name = "to_slide_id", nullable = false)
    private Long toSlideId;

    @Column(name = "occurred_time_ms", nullable = false)
    private Long occurredTimeMs;

    @Column(name = "action_type", nullable = false, length = 30)
    private String actionType;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static SlideClickLog createStart(
            Practice practice,
            Long firstSlideId
    ) {
        SlideClickLog log =
                new SlideClickLog();

        log.id = 1L;
        log.practiceId = practice.getId();
        log.practice = practice;
        log.fromSlideId = null;
        log.toSlideId = firstSlideId;
        log.occurredTimeMs = 0L;
        log.actionType =
                SlideActionType.START.name();
        log.createdAt =
                LocalDateTime.now();

        return log;
    }

    public static SlideClickLog createMove(
            Long eventId,
            Practice practice,
            Long fromSlideId,
            Long toSlideId,
            Long occurredTimeMs
    ) {
        SlideClickLog log =
                new SlideClickLog();

        log.id = eventId;
        log.practiceId = practice.getId();
        log.practice = practice;
        log.fromSlideId = fromSlideId;
        log.toSlideId = toSlideId;
        log.occurredTimeMs = occurredTimeMs;
        log.actionType =
                SlideActionType.MOVE.name();
        log.createdAt =
                LocalDateTime.now();

        return log;
    }

    public static SlideClickLog createEnd(
            Long eventId,
            Practice practice,
            Long currentSlideId,
            Long occurredTimeMs
    ) {
        SlideClickLog log =
                new SlideClickLog();

        log.id = eventId;
        log.practiceId = practice.getId();
        log.practice = practice;
        log.fromSlideId = currentSlideId;
        log.toSlideId = currentSlideId;
        log.occurredTimeMs = occurredTimeMs;
        log.actionType =
                SlideActionType.END.name();
        log.createdAt =
                LocalDateTime.now();

        return log;
    }
}
