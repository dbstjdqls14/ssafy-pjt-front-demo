package com.ssafy.b109.aivo.presentation.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
        name = "presentation_slides",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_presentation_slides_number",
                        columnNames = {"presentation_id", "page"}
                )
        }
)
public class PresentationSlide {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "presentation_id", nullable = false)
    private Presentation presentation;

    @Column(name = "page", nullable = false)
    private Integer slideNumber;

    @Column(name = "image", length = 512, nullable = false)
    private String imageKey;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "timestamp_st", columnDefinition = "REAL")
    private Float startTime;

    @Column(name = "timestamp_end", columnDefinition = "REAL")
    private Float endTime;

    public static PresentationSlide create(
            Presentation presentation,
            int slideNumber,
            String imageKey
    ) {
        PresentationSlide slide = new PresentationSlide();
        slide.presentation = presentation;
        slide.slideNumber = slideNumber;
        slide.imageKey = imageKey;
        return slide;
    }

    public static PresentationSlide copyOf(Presentation newPresentation, PresentationSlide source) {
        PresentationSlide slide = new PresentationSlide();

        slide.presentation = newPresentation;
        slide.slideNumber = source.getSlideNumber();
        slide.imageKey = source.getImageKey();
        slide.description = source.getDescription();

        slide.startTime = null;
        slide.endTime = null;

        return slide;
    }

    public void updateDescription(String description) {
        this.description = description;
    }

    public void updateStartTime(Float startTime) {this.startTime = startTime;}

    public void updateEndTime(Float endTime) {this.endTime = endTime;}

    public void clearTimeline() {
        this.startTime = null;
        this.endTime = null;
    }
}
