package com.ssafy.b109.aivo.resume.dto;

import com.ssafy.b109.aivo.resume.entity.Resume;

import java.time.LocalDateTime;

public record ResumeResponse(
        Long id,
        String title,
        String resumePath,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    public static ResumeResponse from(Resume resume) {
        return new ResumeResponse(
                resume.getId(),
                resume.getTitle(),
                resume.getResumePath(),
                resume.getContent(),
                resume.getCreatedAt(),
                resume.getUpdatedAt()
        );
    }
}
