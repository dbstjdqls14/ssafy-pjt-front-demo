package com.ssafy.b109.aivo.practice.dto;

public record PracticeFolderResponse(
        Long folderId,
        String name,
        String description,
        String type,
        Long practiceCount,
        Long attemptCount
) {
}
