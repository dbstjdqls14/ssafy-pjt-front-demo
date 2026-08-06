package com.ssafy.b109.aivo.presentation.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Component
@RequiredArgsConstructor
public class S3PresentationReader {

    private final S3Client s3Client;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    public ResponseInputStream<GetObjectResponse> open (
            String objectKey
    ) {
        try {
            return s3Client.getObject(
                    GetObjectRequest.builder()
                            .bucket(bucketName)
                            .key(objectKey)
                            .build()
            );
        } catch(S3Exception e) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_FILE_NOT_FOUND
            );
        }
    }

}
