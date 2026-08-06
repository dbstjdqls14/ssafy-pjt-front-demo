package com.ssafy.b109.aivo.resume.dto;

public record ResumeUploadResponse(
        Long resumeId,
        String resumePath,
        String contentType
) {
}
