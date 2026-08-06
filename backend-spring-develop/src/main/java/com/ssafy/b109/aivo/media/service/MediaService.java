package com.ssafy.b109.aivo.media.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.media.entity.Audio;
import com.ssafy.b109.aivo.media.entity.MediaDomain;
import com.ssafy.b109.aivo.media.entity.Video;
import com.ssafy.b109.aivo.media.repository.AudioRepository;
import com.ssafy.b109.aivo.media.repository.VideoRepository;
import com.ssafy.b109.aivo.media.util.MediaFileUtil;
import com.ssafy.b109.aivo.portfolio.util.S3PortfolioUploader;
import com.ssafy.b109.aivo.practice.entity.Practice;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class MediaService {

    private final AudioRepository audioRepository;
    private final VideoRepository videoRepository;
    private final S3PortfolioUploader s3PortfolioUploader;

    @Transactional
    public Audio uploadAudio(
            Long userId,
            Practice practice,
            MediaDomain domain,
            Long domainId,
            MultipartFile file
    ) {
        validateFile(file);

        String objectKey = MediaFileUtil.audioObjectKey(userId, domain, domainId, file);
        String path = upload(objectKey, file);

        Audio audio = audioRepository.findByPracticeId(practice.getId())
                .orElseGet(Audio::new);
        audio.setPractice(practice);
        audio.setPath(path);
        audio.setType(MediaFileUtil.resolveContentType(file));
        audio.setSize(file.getSize());
        audio.setCreatedAt(LocalDateTime.now());

        return audioRepository.saveAndFlush(audio);
    }

    @Transactional
    public Video uploadVideo(
            Long userId,
            Practice practice,
            MediaDomain domain,
            Long domainId,
            MultipartFile file
    ) {
        validateFile(file);

        String objectKey = MediaFileUtil.videoObjectKey(userId, domain, domainId, file);
        String path = upload(objectKey, file);

        Video video = videoRepository.findByPracticeId(practice.getId())
                .orElseGet(Video::new);
        video.setPracticeId(practice.getId());
        video.setPath(path);
        video.setType(MediaFileUtil.resolveContentType(file));
        video.setSize(file.getSize());
        video.setCreatedAt(LocalDateTime.now());

        return videoRepository.saveAndFlush(video);
    }

    private String upload(String objectKey, MultipartFile file) {
        String contentType = MediaFileUtil.resolveContentType(file);
        s3PortfolioUploader.upload(objectKey, file, contentType);
        return s3PortfolioUploader.toObjectPath(objectKey);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_AUDIO_ANALYSIS_REQUEST);
        }
    }
}
