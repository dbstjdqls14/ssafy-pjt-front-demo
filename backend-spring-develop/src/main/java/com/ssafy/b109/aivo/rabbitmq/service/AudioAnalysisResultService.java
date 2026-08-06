package com.ssafy.b109.aivo.rabbitmq.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.b109.aivo.media.entity.Audio;
import com.ssafy.b109.aivo.media.entity.AudioStt;
import com.ssafy.b109.aivo.media.repository.AudioRepository;
import com.ssafy.b109.aivo.media.repository.AudioSttRepository;
import com.ssafy.b109.aivo.rabbitmq.dto.AudioAnalysisCompletedMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AudioAnalysisResultService {

    private final AudioRepository audioRepository;
    private final AudioSttRepository audioSttRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public void saveAudioStt(AudioAnalysisCompletedMessage message) {
        Audio audio = audioRepository.findById(message.audioId())
                .orElseThrow(() -> new RuntimeException("TODO : 커스텀 에러 처리(audio를 찾을 수 없습니다.)"));

        if(!message.practiceId().equals(audio.getPractice().getId())){
            throw new RuntimeException("TODO : 커스텀 에러 처리(audio와 practice가 일치하지 않습니다.)");
        }

        AudioStt audioStt = audioSttRepository.findFirstByAudioIdOrderByIdDesc(audio.getId())
                .orElseGet(AudioStt::new);

        audioStt.setAudio(audio);
        audioStt.setContent(toJson(message));
        audioStt.setCreatedAt(LocalDateTime.now());

        audioSttRepository.save(audioStt);
    }

    private String toJson(AudioAnalysisCompletedMessage message) {
        try {
            return objectMapper.writeValueAsString(message);
        } catch (JsonProcessingException exception) {
            throw new RuntimeException("TODO : 커스텀 에러 처리(audio stt segments 변환에 실패했습니다.)", exception);
        }
    }
}
