package com.ssafy.b109.aivo.resume.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.portfolio.util.PdfTextExtractor;
import com.ssafy.b109.aivo.portfolio.util.S3PortfolioUploader;
import com.ssafy.b109.aivo.resume.dto.ResumeResponse;
import com.ssafy.b109.aivo.resume.dto.ResumeUploadRequest;
import com.ssafy.b109.aivo.resume.dto.ResumeUploadResponse;
import com.ssafy.b109.aivo.resume.entity.Resume;
import com.ssafy.b109.aivo.resume.repository.ResumeRepository;
import com.ssafy.b109.aivo.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ResumeService {

    private static final String PDF_EXTENSION = ".pdf";
    private static final int MAX_TITLE_LENGTH = 50;

    private final ResumeRepository resumeRepository;
    private final S3PortfolioUploader s3PortfolioUploader;
    private final PdfTextExtractor pdfTextExtractor;

    @Transactional(readOnly = true)
    public List<ResumeResponse> getResumes(Long userId) {
        return resumeRepository.findAllByUserIdAndDeletedAtIsNullOrderByIdDesc(userId).stream()
                .map(ResumeResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ResumeResponse getResume(Long resumeId, Long userId) {
        return ResumeResponse.from(getActiveResume(resumeId, userId));
    }

    @Transactional
    public ResumeUploadResponse upload(ResumeUploadRequest request, Long userId) {
        validateRequest(request);

        String objectKey = "resumes/" + userId + "/" + UUID.randomUUID() + PDF_EXTENSION;
        String resumePath = s3PortfolioUploader.toPortfolioPath(objectKey);
        String content = pdfTextExtractor.extract(request.getFile());
        Resume resume = saveResume(request.getTitle(), resumePath, content, userId);
        s3PortfolioUploader.uploadPdf(objectKey, request.getFile());

        return new ResumeUploadResponse(
                resume.getId(),
                resume.getResumePath(),
                S3PortfolioUploader.PDF_CONTENT_TYPE
        );
    }

    @Transactional
    public void deleteResume(Long resumeId, Long userId) {
        Resume resume = getActiveResume(resumeId, userId);
        LocalDateTime now = LocalDateTime.now();
        resume.setDeletedAt(now);
        resume.setUpdatedAt(now);
    }

    private void validateRequest(ResumeUploadRequest request) {
        MultipartFile file = request == null ? null : request.getFile();
        if (request == null
                || !StringUtils.hasText(request.getTitle())
                || request.getTitle().length() > MAX_TITLE_LENGTH
                || file == null
                || file.isEmpty()
                || !StringUtils.hasText(file.getOriginalFilename())
                || !file.getOriginalFilename().toLowerCase().endsWith(PDF_EXTENSION)
                || !S3PortfolioUploader.PDF_CONTENT_TYPE.equals(file.getContentType())) {
            throw new CustomException(ErrorCode.INVALID_RESUME_UPLOAD_REQUEST);
        }
    }

    private Resume saveResume(String title, String resumePath, String content, Long userId) {
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setId(userId);

        Resume resume = new Resume();
        resume.setUser(user);
        resume.setTitle(title);
        resume.setResumePath(resumePath);
        resume.setContent(content);
        resume.setCreatedAt(now);
        resume.setUpdatedAt(now);

        return resumeRepository.saveAndFlush(resume);
    }

    private Resume getActiveResume(Long resumeId, Long userId) {
        return resumeRepository.findByIdAndUserIdAndDeletedAtIsNull(resumeId, userId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_RESUME));
    }
}
