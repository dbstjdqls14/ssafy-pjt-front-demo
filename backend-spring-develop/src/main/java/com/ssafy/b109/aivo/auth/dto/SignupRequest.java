package com.ssafy.b109.aivo.auth.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
public class SignupRequest {
    private String email;
    private String password;
    private String nickname;
}
