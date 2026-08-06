package com.ssafy.b109.aivo.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserProfileUpdateRequest(
        @NotBlank
        @Size(max = 50)
        String nickname,

        @NotNull
        Boolean removeProfileImage
) {
}