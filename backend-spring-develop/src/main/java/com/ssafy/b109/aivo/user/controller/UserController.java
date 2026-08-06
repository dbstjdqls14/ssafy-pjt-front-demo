package com.ssafy.b109.aivo.user.controller;

import com.ssafy.b109.aivo.auth.service.AuthService;
import com.ssafy.b109.aivo.user.dto.UserPasswordUpdateRequest;
import com.ssafy.b109.aivo.user.dto.UserProfileResponse;
import com.ssafy.b109.aivo.user.dto.UserProfileUpdateRequest;
import com.ssafy.b109.aivo.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("${API_VERSION}/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuthService authService;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMyProfile(
            @AuthenticationPrincipal Long userId
    ) {
        UserProfileResponse response =
                userService.getMyProfile(userId);

        return ResponseEntity.ok(response);
    }

    @PatchMapping(
            value = "/me",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<UserProfileResponse>
    updateMyProfile(
            @RequestPart("request")
            @Valid UserProfileUpdateRequest request,

            @RequestPart(
                    value = "profileImage",
                    required = false
            )
            MultipartFile profileImage,

            @AuthenticationPrincipal
            Long userId
    ) {
        UserProfileResponse response =
                userService.updateMyProfile(
                        userId,
                        request,
                        profileImage
                );

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @RequestBody @Valid UserPasswordUpdateRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        userService.changePassword(userId, request);

        return ResponseEntity.noContent()
                .build();
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> withdraw(
            @AuthenticationPrincipal Long userId,

            @RequestHeader(HttpHeaders.AUTHORIZATION)
            String authorizationHeader
    ) {
        userService.withdraw(userId);

        authService.logout(
                authorizationHeader
        );

        return ResponseEntity.noContent()
                .build();
    }
}
