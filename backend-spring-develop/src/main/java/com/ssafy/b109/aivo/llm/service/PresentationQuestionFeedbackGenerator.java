package com.ssafy.b109.aivo.llm.service;

import com.ssafy.b109.aivo.presentation.dto.PresentationQuestionFeedbackResult;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PresentationQuestionFeedbackGenerator {

    private final ChatClient.Builder chatClientBuilder;

    public PresentationQuestionFeedbackResult generate(
            String question,
            String modelAnswer,
            String userAnswer
    ) {
        String prompt = """
                다음 청중 질문에 대한 사용자 답변을 평가하라.
                내부 평가 기준으로 기준 답변을 참고하되, 피드백에는 기준 답변의 존재나 기준 답변과의 직접 비교를 드러내지 마라.
                점수는 0점부터 100점 사이의 정수로 산정하라.
                답변은 반드시 "점수|||피드백" 형식으로 한 줄만 작성하라.
                피드백은 사용자의 답변 자체에 대한 평가와 개선 방향만 작성하라.
                "모범 답변", "기준 답변", "정답", "동일", "비교", "빠진 내용" 같은 표현은 사용하지 마라.
                번호, 따옴표, 마크다운, 추가 설명은 작성하지 마라.
                
                청중 질문:
                %s
                
                내부 평가 기준:
                %s
                
                사용자 답변:
                %s
                """.formatted(question, modelAnswer, userAnswer);

        String content = chatClientBuilder.build()
                .prompt(prompt)
                .call()
                .content()
                .trim();

        String[] values = content.split("\\|\\|\\|", 2);
        short score = parseScore(values[0]);
        String feedback = values.length > 1 ? values[1].trim() : content;

        return new PresentationQuestionFeedbackResult(score, feedback);
    }

    private short parseScore(String value) {
        String number = value.replaceAll("[^0-9]", "");

        if(number.isBlank()){
            return 0;
        }

        int score = Integer.parseInt(number);
        int boundedScore = Math.max(0, Math.min(100, score));
        return (short) boundedScore;
    }
}
