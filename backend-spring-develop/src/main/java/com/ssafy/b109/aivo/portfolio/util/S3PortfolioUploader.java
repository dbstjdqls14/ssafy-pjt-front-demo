package com.ssafy.b109.aivo.portfolio.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;

@Component
@RequiredArgsConstructor
public class S3PortfolioUploader {

    public static final String PDF_CONTENT_TYPE = "application/pdf";
    private static final Duration READ_URL_DURATION = Duration.ofMinutes(30);

    private final PortfolioS3Properties properties;
    private final S3Presigner s3Presigner;

    public String toPortfolioPath(String objectKey) {
        validateProperties();
        return "s3://" + properties.getS3().getBucket() + "/" + objectKey;
    }

    public void uploadPdf(String objectKey, MultipartFile file) {
        upload(objectKey, file, PDF_CONTENT_TYPE);
    }

    public String toObjectPath(String objectKey) {
        validateProperties();
        return "s3://" + properties.getS3().getBucket() + "/" + objectKey;
    }

    public void upload(String objectKey, MultipartFile file, String contentType) {
        validateProperties();

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(properties.getS3().getBucket())
                .key(objectKey)
                .contentType(StringUtils.hasText(contentType) ? contentType : "application/octet-stream")
                .build();

        try (S3Client s3Client = S3Client.builder()
                .region(Region.of(properties.getS3().getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(properties.getAccessKey(), properties.getSecretKey())
                ))
                .build()) {
            uploadWithTempFile(s3Client, putObjectRequest, file);
        } catch (Exception e) {
            throw new CustomException(ErrorCode.S3_UPLOAD_FAILED);
        }
    }

    public String createReadUrl(String objectPathOrKey, String contentType) {
        validateProperties();

        String objectKey = resolveObjectKey(objectPathOrKey);
        GetObjectRequest.Builder requestBuilder = GetObjectRequest.builder()
                .bucket(properties.getS3().getBucket())
                .key(objectKey)
                .responseContentDisposition("inline");

        if (StringUtils.hasText(contentType)) {
            requestBuilder.responseContentType(contentType);
        }

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(READ_URL_DURATION)
                .getObjectRequest(requestBuilder.build())
                .build();

        return s3Presigner.presignGetObject(presignRequest)
                .url()
                .toString();
    }

    private String resolveObjectKey(String objectPathOrKey) {
        if (!StringUtils.hasText(objectPathOrKey)) {
            return objectPathOrKey;
        }

        String objectPathPrefix = "s3://" + properties.getS3().getBucket() + "/";
        if (objectPathOrKey.startsWith(objectPathPrefix)) {
            return objectPathOrKey.substring(objectPathPrefix.length());
        }

        return objectPathOrKey;
    }

    private void uploadWithTempFile(
            S3Client s3Client,
            PutObjectRequest putObjectRequest,
            MultipartFile file
    ) throws IOException {
        Path tempFile = Files.createTempFile("s3-upload-", ".tmp");

        try {
            Files.copy(
                    file.getInputStream(),
                    tempFile,
                    StandardCopyOption.REPLACE_EXISTING
            );

            s3Client.putObject(putObjectRequest, RequestBody.fromFile(tempFile));
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    private void validateProperties() {
        if (!StringUtils.hasText(properties.getAccessKey())
                || !StringUtils.hasText(properties.getSecretKey())
                || !StringUtils.hasText(properties.getS3().getBucket())
                || !StringUtils.hasText(properties.getS3().getRegion())) {
            throw new CustomException(ErrorCode.INVALID_S3_CONFIG);
        }
    }
}
