package com.ssafy.b109.aivo.auth.service;

import com.ssafy.b109.aivo.auth.dto.LoginRequest;
import com.ssafy.b109.aivo.auth.dto.LoginResponse;
import com.ssafy.b109.aivo.auth.dto.SignupRequest;
import com.ssafy.b109.aivo.auth.dto.SignupResponse;
import com.ssafy.b109.aivo.auth.util.PasswordEncryptor;
import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.global.jwt.JwtBlacklistService;
import com.ssafy.b109.aivo.global.jwt.JwtProvider;
import com.ssafy.b109.aivo.global.jwt.dto.TokenResponse;
import com.ssafy.b109.aivo.user.entity.User;
import com.ssafy.b109.aivo.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncryptor passwordEncryptor;
    private final JwtProvider jwtProvider;
    private final JwtBlacklistService jwtBlacklistService;

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        if (request.getNickname() == null || request.getNickname().isBlank()) {
            throw new CustomException(ErrorCode.INVALID_SIGNUP_REQUEST);
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new CustomException(ErrorCode.DUPLICATED_EMAIL);
        }

        if (userRepository.existsByNickname(request.getNickname())) {
            throw new CustomException(ErrorCode.DUPLICATED_NICKNAME);
        }

        LocalDateTime now = LocalDateTime.now();

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncryptor.encrypt(request.getPassword()));
        user.setNickname(request.getNickname());
        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        User savedUser = userRepository.save(user);

        TokenResponse tokenResponse = new TokenResponse();
        tokenResponse.setAccessToken(jwtProvider.createAccessToken(savedUser));

        SignupResponse response = new SignupResponse();
        response.setTokenResponse(tokenResponse);
        return response;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        LocalDateTime now = LocalDateTime.now();

        User user = userRepository.findUserByEmail(request.getEmail())
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_USER));

        if(!(request.getEmail().equals(user.getEmail())
                && passwordEncryptor.decrypt(user.getPassword()).equals(request.getPassword()))){
            throw new CustomException(ErrorCode.INVALID_LOGIN_REQUEST);
        }
        TokenResponse tokenResponse = new TokenResponse();
        tokenResponse.setAccessToken(jwtProvider.createAccessToken(user));
        LoginResponse response = new LoginResponse();
        response.setTokenResponse(tokenResponse);

        return response;
    }

    public void logout(String authorizationHeader) {
        String accessToken = jwtProvider.resolveAccessToken(authorizationHeader);
        jwtBlacklistService.blacklist(accessToken, jwtProvider.getRemainingTtl(accessToken));
    }
}
