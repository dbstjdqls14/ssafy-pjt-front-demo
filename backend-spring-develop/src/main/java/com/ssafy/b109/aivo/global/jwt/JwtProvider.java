package com.ssafy.b109.aivo.global.jwt;

import com.ssafy.b109.aivo.global.jwt.config.JwtConfig;
import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Base64;

@Component
@RequiredArgsConstructor
public class JwtProvider {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtConfig jwtConfig;

    public String createAccessToken(User user) {
        Instant expiresAt = Instant.now().plusMillis(jwtConfig.getAccessTokenExpirationMilliseconds());

        return Jwts.builder()
                .claim("userId", user.getId())
                .expiration(Date.from(expiresAt))
                .signWith(getSigningKey())
                .compact();
    }

    public String resolveAccessToken(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new CustomException(ErrorCode.MISSING_TOKEN);
        }

        if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
            throw new CustomException(ErrorCode.INVALID_AUTH_HEADER);
        }

        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            throw new CustomException(ErrorCode.MISSING_TOKEN);
        }

        return token;
    }

    public Long getUserId(String token) {
        Number userId = parseClaims(token).get("userId", Number.class);
        if (userId == null) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);
        }
        return userId.longValue();
    }

    public Duration getRemainingTtl(String token) {
        Date expiration = parseClaims(token).getExpiration();
        if (expiration == null) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);
        }

        Duration ttl = Duration.between(Instant.now(), expiration.toInstant());
        if (!ttl.isPositive()) {
            throw new CustomException(ErrorCode.EXPIRED_TOKEN);
        }

        return ttl;
    }

    private Claims parseClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            throw new CustomException(ErrorCode.EXPIRED_TOKEN);
        } catch (JwtException | IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);
        }
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(Base64.getDecoder().decode(jwtConfig.getSecretKey()));
    }
}
