package com.ssafy.b109.aivo.practice.dto;

import jakarta.validation.constraints.Size;

public record PracticeFolderUpdateRequest(
        @Size(max = 128, message = "폴더 이름은 128자 이하여야 합니다.")
        String name,
        @Size(max = 500, message = "폴더 설명은 500자 이하여야 합니다.")
        String description,
        String type
) {
}
