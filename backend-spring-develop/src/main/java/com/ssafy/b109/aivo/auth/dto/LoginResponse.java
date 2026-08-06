package com.ssafy.b109.aivo.auth.dto;

import com.ssafy.b109.aivo.global.jwt.dto.TokenResponse;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginResponse {
    private TokenResponse tokenResponse;
}
