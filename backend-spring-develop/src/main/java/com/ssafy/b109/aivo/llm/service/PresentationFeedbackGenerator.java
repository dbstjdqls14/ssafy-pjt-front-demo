package com.ssafy.b109.aivo.llm.service;

import com.ssafy.b109.aivo.presentation.dto.PresentationSlideFeedbackResult;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PresentationFeedbackGenerator {

    private final ChatClient.Builder chatClientBuilder;

    public PresentationSlideFeedbackResult generate(
            Integer slideNumber,
            String slideDescription,
            String userSpeech
    ) {
        String prompt = """
                다음은 발표 슬라이드의 핵심 내용과 해당 슬라이드 구간에서 사용자가 실제로 발화한 내용이다.
                두 내용을 비교해 사용자가 슬라이드의 핵심 내용을 얼마나 잘 설명했는지 평가하라.
                점수는 0점부터 100점 사이의 정수로 산정하라.
                답변은 반드시 "점수|||피드백" 형식으로 한 줄만 작성하라.
                피드백은 사용자의 발표 내용에 대한 평가와 개선 방향만 작성하라.
                슬라이드 핵심 내용에 있는데 발화에서 부족했던 부분이 있으면 구체적으로 짚어라.
                발화 내용이 비어 있거나 슬라이드 핵심 내용과 관련이 낮으면 그 점을 반영하라.
                번호, 따옴표, 마크다운, 추가 설명은 작성하지 마라.
                
                슬라이드 번호:
                %d
                
                슬라이드 핵심 내용:
                %s
                
                사용자 발화 내용:
                %s
                """.formatted(
                slideNumber,
                blankToDefault(slideDescription, "슬라이드 핵심 내용 없음"),
                blankToDefault(userSpeech, "발화 내용 없음")
        );

        String content = chatClientBuilder.build()
                .prompt(prompt)
                .call()
                .content()
                .trim();

        String[] values = content.split("\\|\\|\\|", 2);
        short score = parseScore(values[0]);
        String feedback = values.length > 1 ? values[1].trim() : content;

        return new PresentationSlideFeedbackResult(score, feedback);
    }

    private String blankToDefault(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }

    private short parseScore(String value) {
        String number = value.replaceAll("[^0-9]", "");

        if (number.isBlank()) {
            return 0;
        }

        int score = Integer.parseInt(number);
        int boundedScore = Math.max(0, Math.min(100, score));
        return (short) boundedScore;
    }
}
