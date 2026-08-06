package com.ssafy.b109.aivo.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "Invalid token.", "40101"),
    EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "Expired token.", "40102"),
    MISSING_TOKEN(HttpStatus.BAD_REQUEST, "Missing token.", "40001"),
    INVALID_AUTH_HEADER(HttpStatus.BAD_REQUEST, "Invalid authorization header.", "40002"),
    BLACKLISTED_TOKEN(HttpStatus.UNAUTHORIZED, "Blacklisted token.", "40103"),

    INVALID_SIGNUP_REQUEST(HttpStatus.BAD_REQUEST, "Invalid signup request.", "40003"),
    INVALID_LOGIN_REQUEST(HttpStatus.BAD_REQUEST, "Invalid login request.", "40004"),
    INVALID_PORTFOLIO_UPLOAD_REQUEST(HttpStatus.BAD_REQUEST, "Invalid portfolio upload request.", "40005"),
    INVALID_INTERVIEW_START_REQUEST(HttpStatus.BAD_REQUEST, "Invalid interview start request.", "40006"),
    INVALID_RESUME_UPLOAD_REQUEST(HttpStatus.BAD_REQUEST, "Invalid resume upload request.", "40007"),
    INVALID_PROFILE_IMAGE(HttpStatus.BAD_REQUEST, "Invalid profile image.", "40008"),
    NOT_FOUND_USER(HttpStatus.NOT_FOUND, "User Not Found", "40401"),
    NOT_FOUND_JOB(HttpStatus.NOT_FOUND, "Job Not Found", "40402"),
    NOT_FOUND_OCCUPATION(HttpStatus.NOT_FOUND, "Occupation Not Found", "40403"),
    NOT_FOUND_PORTFOLIO(HttpStatus.NOT_FOUND, "Portfolio Not Found", "40404"),
    NOT_FOUND_COMPANY(HttpStatus.NOT_FOUND, "Company Not Found", "40405"),
    NOT_FOUND_INTERVIEWER(HttpStatus.NOT_FOUND, "Interviewer Not Found", "40406"),
    NOT_FOUND_PRACTICE_FOLDER(HttpStatus.NOT_FOUND, "Practice Folder Not Found", "40407"),
    NOT_FOUND_RESUME(HttpStatus.NOT_FOUND, "Resume Not Found", "40408"),
    NOT_FOUND_INTERVIEW(HttpStatus.NOT_FOUND, "Interview Not Found", "40409"),
    NOT_FOUND_INTERVIEW_REPORT(HttpStatus.NOT_FOUND, "Interview Report Not Found", "40410"),
    NOT_FOUND_INTERVIEW_QUESTION(HttpStatus.NOT_FOUND, "Interview Question Not Found", "40411"),
    NOT_FOUND_QUESTION_FEEDBACK(HttpStatus.NOT_FOUND, "Question Feedback Not Found", "40412"),
    NOT_FOUND_PRACTICE(HttpStatus.NOT_FOUND, "Practice Not Found", "40413"),
    INVALID_AUDIO_ANALYSIS_REQUEST(HttpStatus.BAD_REQUEST, "Invalid audio analysis request.", "40008"),
    INVALID_INTERVIEW_COMPLETE_REQUEST(HttpStatus.BAD_REQUEST, "Invalid interview complete request.", "40009"),
    INVALID_INTERVIEW_QUESTION_REQUEST(HttpStatus.BAD_REQUEST, "Invalid interview question request.", "40010"),
    AUDIO_ANALYSIS_FAILED(HttpStatus.BAD_GATEWAY, "Audio analysis failed.", "50201"),
    AUDIO_STT_FAILED(HttpStatus.BAD_GATEWAY, "Audio STT failed.", "50202"),
    REPORT_GENERATION_FAILED(HttpStatus.BAD_GATEWAY, "Report generation failed.", "50203"),

    DUPLICATED_EMAIL(HttpStatus.CONFLICT, "Duplicated email.", "40902"),
    DUPLICATED_NICKNAME(HttpStatus.CONFLICT, "Duplicated nickname.", "40901"),
    INVALID_CURRENT_PASSWORD(HttpStatus.BAD_REQUEST,"Current password is incorrect.","40011"),
    INVALID_NEW_PASSWORD(HttpStatus.BAD_REQUEST, "Invalid new password.", "40012"),
    EMPTY_PRESENTATION_FILE(HttpStatus.BAD_REQUEST, "발표 자료 파일이 비어있습니다.", "40020"),
    MISSING_PRESENTATION_FILE_EXTENSION(HttpStatus.BAD_REQUEST, "파일 확장자를 확인할 수 없습니다.", "40021"),
    UNSUPPORTED_PRESENTATION_FILE_TYPE(HttpStatus.BAD_REQUEST, "PPTX 또는 PDF 파일만 업로드할 수 있습니다.", "40022"),
    PRESENTATION_FILE_NOT_FOUND(HttpStatus.BAD_REQUEST,"변환할 발표 자료 파일이 존재하지 않습니다.","40023"),
    EMPTY_PRESENTATION_SLIDES(HttpStatus.BAD_REQUEST,"발표 자료에 슬라이드가 존재하지 않습니다.","40024"),
    INVALID_PRESENTATION_DOCUMENT(HttpStatus.BAD_REQUEST, "잘못된 프레젠테이션 파일입니다.", "40025"),
    EMPTY_PRESENTATION_SLIDE_IMAGE(HttpStatus.BAD_REQUEST, "프레젠테이션 슬라이드 이미지가 비어있습니다.", "40026"),
    INVALID_PRESENTATION_SLIDE_IMAGE_KEY(HttpStatus.BAD_REQUEST, "잘못된 프레젠테이션 슬라이드 이미지 키입니다.", "40027"),
    INVALID_PRESENTATION_SLIDE_DESCRIPTION_UPDATE(HttpStatus.BAD_REQUEST, "슬라이드 핵심 내용 수정 요청이 올바르지 않습니다.", "40028"),
    INVALID_PRESENTATION_SLIDE_EVENT(HttpStatus.BAD_REQUEST, "슬라이드 이동 이벤트가 올바르지 않습니다.", "40029"),
    PRESENTATION_NOT_FOUND(HttpStatus.NOT_FOUND, "발표 자료를 찾을 수 없습니다.", "40420"),
    PRESENTATION_SLIDE_NOT_FOUND(HttpStatus.NOT_FOUND, "발표 슬라이드를 찾을 수 없습니다.", "40421"),
    PRESENTATION_ALREADY_PROCESSING(HttpStatus.CONFLICT, "발표 자료가 이미 처리 중입니다.", "40920"),
    PRESENTATION_NOT_COMPLETED(HttpStatus.CONFLICT, "발표 자료 분석이 완료된 후 수정할 수 있습니다.", "40921"),
    PRESENTATION_PRACTICE_ALREADY_STARTED(HttpStatus.CONFLICT, "발표 연습이 이미 시작되었습니다.", "40922"),
    PRESENTATION_PRACTICE_NOT_STARTED(HttpStatus.CONFLICT, "발표 연습이 시작되지 않았습니다.", "40923"),
    PRESENTATION_PRACTICE_ALREADY_COMPLETED(HttpStatus.CONFLICT, "이미 종료된 발표 연습입니다.", "40924"),
    PRESENTATION_IMAGE_WRITER_NOT_FOUND(HttpStatus.INTERNAL_SERVER_ERROR,"PNG 이미지 변환 기능을 사용할 수 없습니다.","50020"),
    PRESENTATION_SLIDE_IMAGE_CREATE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR,"슬라이드 이미지 생성에 실패했습니다.","50021"),
    PRESENTATION_SLIDE_CONVERSION_FAILED(HttpStatus.INTERNAL_SERVER_ERROR,"발표 자료를 슬라이드 이미지로 변환하지 못했습니다.","50022"),
    PRESENTATION_ANALYSIS_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "발표 자료 분석에 실패했습니다.", "50023"),

    INVALID_S3_CONFIG(HttpStatus.INTERNAL_SERVER_ERROR, "Invalid S3 config.", "50001"),
    S3_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "S3 upload failed.", "50002");

    private final HttpStatus httpStatus;
    private final String message;
    private final String errorCode;
}
