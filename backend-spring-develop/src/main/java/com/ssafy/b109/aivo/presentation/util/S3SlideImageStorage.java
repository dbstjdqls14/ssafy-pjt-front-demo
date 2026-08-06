package com.ssafy.b109.aivo.presentation.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.net.URI;
import java.time.Duration;

@Component
@RequiredArgsConstructor
public class S3SlideImageStorage {

    private static final String CONTENT_TYPE = "image/png";
    private static final Duration READ_URL_DURATION =
            Duration.ofMinutes(30);

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    public String upload(
            Long presentationId,
            String uploadVersion,
            int slideNumber,
            byte[] imageData
    ) {
        if (imageData == null || imageData.length == 0) {
            throw new CustomException(ErrorCode.EMPTY_PRESENTATION_SLIDE_IMAGE);
        }

        String objectKey = createObjectKey(
                presentationId,
                uploadVersion,
                slideNumber
        );

        PutObjectRequest request =
                PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(objectKey)
                        .contentType(CONTENT_TYPE)
                        .contentLength(
                                (long) imageData.length
                        )
                        .build();

        try {
            s3Client.putObject(
                    request,
                    RequestBody.fromBytes(imageData)
            );

            return objectKey;
        } catch (SdkException e) {
            throw new CustomException(
                    ErrorCode.INVALID_S3_CONFIG
            );
        }
    }

    public URI createReadUrl(
            String objectKey
    ) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new CustomException(
                    ErrorCode.INVALID_PRESENTATION_SLIDE_IMAGE_KEY
            );
        }

        GetObjectRequest getObjectRequest =
                GetObjectRequest.builder()
                        .bucket(bucketName)
                        .key(objectKey)
                        .responseContentType(CONTENT_TYPE)
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
            String url = s3Presigner
                    .presignGetObject(presignRequest)
                    .url()
                    .toString();

            return URI.create(url);
        } catch (SdkException e) {
            throw new CustomException(
                    ErrorCode.INVALID_S3_CONFIG
            );
        }
    }

    public void delete(
            String objectKey
    ) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }

        DeleteObjectRequest request =
                DeleteObjectRequest.builder()
                        .bucket(bucketName)
                        .key(objectKey)
                        .build();

        try {
            s3Client.deleteObject(request);
        } catch (SdkException e) {
            throw new CustomException(
                    ErrorCode.INVALID_S3_CONFIG
            );
        }
    }

    private String createObjectKey(
            Long presentationId,
            String uploadVersion,
            int slideNumber
    ) {
        return "presentations/%d/slides/%s/%03d.png"
                .formatted(
                        presentationId,
                        uploadVersion,
                        slideNumber
                );
    }
}
