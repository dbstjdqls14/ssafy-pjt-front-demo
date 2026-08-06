package com.ssafy.b109.aivo.auth.controller;

import com.ssafy.b109.aivo.auth.dto.LoginRequest;
import com.ssafy.b109.aivo.auth.dto.LoginResponse;
import com.ssafy.b109.aivo.auth.dto.SignupRequest;
import com.ssafy.b109.aivo.auth.dto.SignupResponse;
import com.ssafy.b109.aivo.auth.service.AuthService;
import com.ssafy.b109.aivo.auth.util.AuthValidator;
import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${API_VERSION}/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final AuthValidator authValidator;

    @PostMapping("/signup")
    public ResponseEntity<SignupResponse> signup(@RequestBody SignupRequest req) {
        if (!(authValidator.isValidEmail(req.getEmail())
                && authValidator.isValidPassword(req.getPassword()))) {
            throw new CustomException(ErrorCode.INVALID_SIGNUP_REQUEST);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(req));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest req){
        if (!(authValidator.isValidEmail(req.getEmail())
                && authValidator.isValidPassword(req.getPassword()))) {
            throw new CustomException(ErrorCode.INVALID_LOGIN_REQUEST);
        }
        log.info(""+req.getEmail()+" "+req.getPassword());
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.login(req));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        authService.logout(authorizationHeader);
        return ResponseEntity.noContent().build();
    }
}
