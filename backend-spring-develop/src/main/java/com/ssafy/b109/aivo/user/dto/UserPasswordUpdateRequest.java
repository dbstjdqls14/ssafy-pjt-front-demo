package com.ssafy.b109.aivo.user.dto;

import jakarta.validation.constraints.NotBlank;

public record UserPasswordUpdateRequest (
        @NotBlank
        String currentPassword,

        @NotBlank
        String newPassword,

        @NotBlank
        String newPasswordConfirm
){
}
