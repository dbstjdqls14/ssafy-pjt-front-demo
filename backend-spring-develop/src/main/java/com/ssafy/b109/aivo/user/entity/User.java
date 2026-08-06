package com.ssafy.b109.aivo.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "nickname", nullable = false, length = 50)
    private String nickname;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "email")
    private String email;

    @Column(name = "password")
    private String password;

    @Column(name = "profile_image_url", length = 1024)
    private String profileImageKey;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public void updateProfile(String nickname, String profileImageKey) {
        this.nickname = nickname;
        this.profileImageKey = profileImageKey;
        this.updatedAt = LocalDateTime.now();
    }

    public void changePassword(String encryptedPassword) {
        this.password = encryptedPassword;
        this.updatedAt = LocalDateTime.now();
    }

    public void withdraw(
            String anonymousEmail,
            String anonymousNickname,
            String encryptedRandomPassword
    ) {
        this.email = anonymousEmail;
        this.nickname = anonymousNickname;
        this.password = encryptedRandomPassword;
        this.profileImageKey = null;
        this.deletedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
