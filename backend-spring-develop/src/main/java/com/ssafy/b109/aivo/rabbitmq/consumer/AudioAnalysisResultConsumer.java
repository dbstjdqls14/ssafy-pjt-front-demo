package com.ssafy.b109.aivo.rabbitmq.consumer;

import com.ssafy.b109.aivo.global.rabbitmq.config.RabbitMQConfig;
import com.ssafy.b109.aivo.presentation.service.PresentationAnalysisService;
import com.ssafy.b109.aivo.rabbitmq.dto.AudioAnalysisCompletedMessage;
import com.ssafy.b109.aivo.rabbitmq.service.AudioAnalysisResultService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AudioAnalysisResultConsumer {

    private final AudioAnalysisResultService audioAnalysisResultService;
    private final PresentationAnalysisService presentationAnalysisService;

    @RabbitListener(queues = RabbitMQConfig.RESULT_QUEUE)
    public void consume(AudioAnalysisCompletedMessage message) {
        log.info(
                "오디오 분석 결과 수신: eventType={}, requestId={}, practiceId={}, audioId={}, segmentCount={}",
                message.eventType(),
                message.requestId(),
                message.practiceId(),
                message.audioId(),
                message.segments() == null ? 0 : message.segments().size()
        );

        audioAnalysisResultService.saveAudioStt(message);
        presentationAnalysisService.generateSlideFeedbacksIfPresentationPractice(
                message.practiceId()
        );
    }
}
