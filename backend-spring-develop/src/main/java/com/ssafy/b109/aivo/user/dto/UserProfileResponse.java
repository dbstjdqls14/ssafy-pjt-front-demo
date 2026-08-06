package com.ssafy.b109.aivo.user.dto;

import java.time.LocalDateTime;

public record UserProfileResponse(
        Long userId,
        String email,
        String nickname,
        String profileImageUrl,
        LocalDateTime createdAt
) {
}