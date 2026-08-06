package com.ssafy.b109.aivo.global.jwt;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class JwtBlacklistService {

    private static final String KEY_PREFIX = "blacklist:access:";

    private final StringRedisTemplate redisTemplate;

    public void blacklist(String token, Duration ttl) {
        if (ttl.isPositive()) {
            redisTemplate.opsForValue().set(KEY_PREFIX + token, "logout", ttl);
        }
    }

    public boolean isBlacklisted(String token) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(KEY_PREFIX + token));
    }
}
