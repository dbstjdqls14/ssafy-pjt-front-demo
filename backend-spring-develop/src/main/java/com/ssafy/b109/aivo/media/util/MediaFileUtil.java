package com.ssafy.b109.aivo.media.util;

import com.ssafy.b109.aivo.media.entity.MediaDomain;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public final class MediaFileUtil {

    private static final String DEFAULT_AUDIO_CONTENT_TYPE = "audio/wav";
    private static final String DEFAULT_AUDIO_EXTENSION = ".wav";
    private static final String DEFAULT_VIDEO_EXTENSION = ".webm";

    private MediaFileUtil() {
    }

    public static String resolveContentType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            return DEFAULT_AUDIO_CONTENT_TYPE;
        }

        String baseContentType = contentType.split(";", 2)[0].trim();
        if (baseContentType.isBlank() || !baseContentType.contains("/")) {
            return DEFAULT_AUDIO_CONTENT_TYPE;
        }

        return baseContentType;
    }

    public static String audioObjectKey(Long userId, MediaDomain domain, Long domainId, MultipartFile file) {
        return objectKey(userId, domain, domainId, "audio", resolveExtension(file, DEFAULT_AUDIO_EXTENSION));
    }

    public static String videoObjectKey(Long userId, MediaDomain domain, Long domainId, MultipartFile file) {
        return objectKey(userId, domain, domainId, "video", resolveExtension(file, DEFAULT_VIDEO_EXTENSION));
    }

    private static String objectKey(
            Long userId,
            MediaDomain domain,
            Long domainId,
            String mediaType,
            String extension
    ) {
        return "%s/%d/%d/%s/%s%s".formatted(
                domain.path(),
                userId,
                domainId,
                mediaType,
                UUID.randomUUID(),
                extension
        );
    }

    private static String resolveExtension(MultipartFile file, String defaultExtension) {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            return defaultExtension;
        }

        int extensionIndex = originalFilename.lastIndexOf('.');
        if (extensionIndex < 0 || extensionIndex == originalFilename.length() - 1) {
            return defaultExtension;
        }

        return originalFilename.substring(extensionIndex).toLowerCase();
    }
}
