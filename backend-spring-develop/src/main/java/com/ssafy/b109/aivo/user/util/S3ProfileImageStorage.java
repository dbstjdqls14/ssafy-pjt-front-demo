package com.ssafy.b109.aivo.user.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class S3ProfileImageStorage {

    private static final Duration READ_URL_DURATION = Duration.ofMinutes(30);
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    public String upload(
            Long userId,
            MultipartFile image
    ) {
        validate(image);

        String contentType =
                image.getContentType();

        String extension =
                getExtension(contentType);

        String objectKey =
                "users/%d/profile/%s.%s"
                        .formatted(
                                userId,
                                UUID.randomUUID(),
                                extension
                        );

        PutObjectRequest request =
                PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(objectKey)
                        .contentType(contentType)
                        .contentLength(image.getSize())
                        .build();

        try {
            s3Client.putObject(
                    request,
                    RequestBody.fromBytes(
                            image.getBytes()
                    )
            );

            return objectKey;
        } catch (IOException | SdkException exception) {
            throw new CustomException(
                    ErrorCode.INVALID_S3_CONFIG
            );
        }
    }

    public String createReadUrl(
            String objectKey
    ) {
        if (objectKey == null ||
                objectKey.isBlank()) {
            return null;
        }

        GetObjectRequest getObjectRequest =
                GetObjectRequest.builder()
                        .bucket(bucketName)
                        .key(objectKey)
                        .responseContentDisposition("inline")
                        .build();

        GetObjectPresignRequest presignRequest =
                GetObjectPresignRequest.builder()
                        .signatureDuration(
                                READ_URL_DURATION
                        )
                        .getObjectRequest(
                                getObjectRequest
                        )
                        .build();

        try {
            return s3Presigner
                    .presignGetObject(presignRequest)
                    .url()
                    .toString();
        } catch (SdkException exception) {
            throw new CustomException(
                    ErrorCode.INVALID_S3_CONFIG
            );
        }
    }

    public void delete(
            String objectKey
    ) {
        if (objectKey == null ||
                objectKey.isBlank()) {
            return;
        }

        try {
            s3Client.deleteObject(
                    DeleteObjectRequest.builder()
                            .bucket(bucketName)
                            .key(objectKey)
                            .build()
            );
        } catch (SdkException exception) {
            throw new CustomException(
                    ErrorCode.INVALID_S3_CONFIG
            );
        }
    }

    private void validate(
            MultipartFile image
    ) {
        if (image == null ||
                image.isEmpty()) {
            throw new CustomException(
                    ErrorCode.INVALID_PROFILE_IMAGE
            );
        }

        if (image.getSize() > 5 * 1024 * 1024) {
            throw new CustomException(
                    ErrorCode.INVALID_PROFILE_IMAGE
            );
        }

        String contentType =
                image.getContentType();

        if (!List.of(
                "image/jpeg",
                "image/png",
                "image/webp"
        ).contains(contentType)) {
            throw new CustomException(
                    ErrorCode.INVALID_PROFILE_IMAGE
            );
        }
    }

    private String getExtension(
            String contentType
    ) {
        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> throw new CustomException(
                    ErrorCode.INVALID_PROFILE_IMAGE
            );
        };
    }
}
