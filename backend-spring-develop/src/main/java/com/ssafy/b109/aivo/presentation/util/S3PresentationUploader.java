package com.ssafy.b109.aivo.presentation.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class S3PresentationUploader {

    private final S3Client s3Client;

    @Value("${aws.s3.bucket}")
    private String bucketName;
    public String uploadPresentation(
            Long presentationId,
            MultipartFile file
    ) {

        String originalFilename = Objects.requireNonNull(file.getOriginalFilename());
        String extension = extractExtension(originalFilename);
        String contentType = resolveContentType(extension);
        String objectKey = createObjectKey(presentationId, extension);

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .contentType(contentType)
                .contentLength(file.getSize())
                .build();

        try(InputStream inputStream = file.getInputStream()) {
            s3Client.putObject(
                    putObjectRequest,
                    RequestBody.fromInputStream(
                            inputStream,
                            file.getSize()
                    )
            );

            return objectKey;
        } catch(IOException e) {
            throw new CustomException(ErrorCode.INVALID_PRESENTATION_DOCUMENT);
        } catch (S3Exception e) {
            throw new CustomException(ErrorCode.INVALID_S3_CONFIG);
        }
    }

    private String createObjectKey(
            Long presentationId,
            String extension
    ) {
        return "presentations/%d/original.%s"
                .formatted(
                        presentationId,
                        extension
                );
    }

    private String resolveContentType(
            String extension
    ) {
        return switch (extension) {
            case "ppt" ->
                    "application/vnd.ms-powerpoint";

            case "pptx" ->
                    "application/vnd.openxmlformats-officedocument"
                            + ".presentationml.presentation";

            case "pdf" ->
                    MediaType.APPLICATION_PDF_VALUE;

            default ->
                    MediaType.APPLICATION_OCTET_STREAM_VALUE;
        };
    }

    private String extractExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');

        return filename
                .substring(dotIndex + 1)
                .toLowerCase(Locale.ROOT);
    }


}
