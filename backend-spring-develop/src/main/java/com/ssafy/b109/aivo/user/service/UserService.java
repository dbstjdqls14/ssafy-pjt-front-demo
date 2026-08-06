package com.ssafy.b109.aivo.user.service;

import com.ssafy.b109.aivo.auth.util.AuthValidator;
import com.ssafy.b109.aivo.auth.util.PasswordEncryptor;
import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.user.dto.UserPasswordUpdateRequest;
import com.ssafy.b109.aivo.user.dto.UserProfileResponse;
import com.ssafy.b109.aivo.user.dto.UserProfileUpdateRequest;
import com.ssafy.b109.aivo.user.entity.User;
import com.ssafy.b109.aivo.user.repository.UserRepository;
import com.ssafy.b109.aivo.user.util.S3ProfileImageStorage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final S3ProfileImageStorage profileImageStorage;
    private final PasswordEncryptor passwordEncryptor;
    private final AuthValidator authValidator;


    public UserProfileResponse getMyProfile(
            Long userId
    ) {
        User user =
                userRepository.findById(userId)
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.NOT_FOUND_USER
                                )
                        );

        String profileImageUrl = profileImageStorage.createReadUrl(
                user.getProfileImageKey()
        );

        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                profileImageUrl,
                user.getCreatedAt()
        );
    }

    @Transactional
    public UserProfileResponse updateMyProfile(
            Long userId,
            UserProfileUpdateRequest request,
            MultipartFile profileImage
    ) {
        User user =
                userRepository.findById(userId)
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.NOT_FOUND_USER
                                )
                        );

        if (userRepository.existsByNicknameAndIdNot(
                request.nickname(),
                userId
        )) {
            throw new CustomException(
                    ErrorCode.DUPLICATED_NICKNAME
            );
        }

        boolean hasNewImage =
                profileImage != null &&
                        !profileImage.isEmpty();

        if (hasNewImage &&
                request.removeProfileImage()) {
            throw new CustomException(
                    ErrorCode.INVALID_PROFILE_IMAGE
            );
        }

        String oldProfileImageKey =
                user.getProfileImageKey();

        String newProfileImageKey =
                oldProfileImageKey;

        if (hasNewImage) {
            newProfileImageKey =
                    profileImageStorage.upload(
                            userId,
                            profileImage
                    );
        } else if (request.removeProfileImage()) {
            newProfileImageKey = null;
        }

        user.updateProfile(
                request.nickname(),
                newProfileImageKey
        );

        String profileImageUrl =
                profileImageStorage.createReadUrl(
                        newProfileImageKey
                );

        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                profileImageUrl,
                user.getCreatedAt()
        );
    }

    @Transactional
    public void changePassword(
            Long userId,
            UserPasswordUpdateRequest request
    ) {
        User user =
                userRepository.findById(userId)
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.NOT_FOUND_USER
                                )
                        );

        String currentPassword =
                passwordEncryptor.decrypt(
                        user.getPassword()
                );

        if (!currentPassword.equals(
                request.currentPassword()
        )) {
            throw new CustomException(
                    ErrorCode.INVALID_CURRENT_PASSWORD
            );
        }

        if (!request.newPassword().equals(
                request.newPasswordConfirm()
        )) {
            throw new CustomException(
                    ErrorCode.INVALID_NEW_PASSWORD
            );
        }

        if (!authValidator.isValidPassword(
                request.newPassword()
        )) {
            throw new CustomException(
                    ErrorCode.INVALID_NEW_PASSWORD
            );
        }

        if (currentPassword.equals(
                request.newPassword()
        )) {
            throw new CustomException(
                    ErrorCode.INVALID_NEW_PASSWORD
            );
        }

        String encryptedNewPassword =
                passwordEncryptor.encrypt(
                        request.newPassword()
                );

        user.changePassword(
                encryptedNewPassword
        );

    }

    @Transactional
    public void withdraw(
            Long userId
    ) {
        User user =
                userRepository.findById(userId)
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.NOT_FOUND_USER
                                )
                        );

        String oldProfileImageKey =
                user.getProfileImageKey();

        String suffix =
                userId + "_" +
                        UUID.randomUUID()
                                .toString()
                                .replace("-", "");

        String anonymousEmail =
                "deleted_" + suffix +
                        "@deleted.local";

        String anonymousNickname =
                "탈퇴회원_" + suffix;

        String randomPassword =
                passwordEncryptor.encrypt(
                        UUID.randomUUID().toString()
                );

        user.withdraw(
                anonymousEmail,
                anonymousNickname,
                randomPassword
        );

        if (oldProfileImageKey != null &&
                !oldProfileImageKey.isBlank()) {
            deleteProfileImageAfterCommit(
                    oldProfileImageKey
            );
        }
    }

    private void deleteProfileImageAfterCommit(
            String imageKey
    ) {
        TransactionSynchronizationManager
                .registerSynchronization(
                        new TransactionSynchronization() {
                            @Override
                            public void afterCommit() {
                                try {
                                    profileImageStorage.delete(
                                            imageKey
                                    );
                                } catch (Exception exception) {
                                    log.error(
                                            "프로필 이미지 삭제 실패: key={}",
                                            imageKey,
                                            exception
                                    );
                                }
                            }
                        }
                );
    }
}