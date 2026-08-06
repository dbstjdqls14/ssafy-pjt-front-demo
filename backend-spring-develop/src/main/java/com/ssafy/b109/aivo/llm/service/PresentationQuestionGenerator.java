package com.ssafy.b109.aivo.llm.service;

import com.ssafy.b109.aivo.presentation.dto.AudienceQuestionLLMDto;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PresentationQuestionGenerator {

    private final ChatClient.Builder chatClientBuilder;

    public List<String> generate(
            List<AudienceQuestionLLMDto> generateRequest
    ) {
        String prompt1 = """
                다음은 사용자가 발표해야 하는 슬라이드별 내용과 슬라이드별 실제 발화 내용이다.
                사용자의 발표를 들은 청중이 할만한 질문과 그 질문에 대한 사용자의 모범 답변 쌍을 10개 생성하라.
                각 줄은 반드시 "질문|||모범답변" 형식으로만 작성하라.
                번호, 따옴표, 마크다운, 추가 설명은 작성하지 마라.
                
                """;

        StringBuilder promptBuilder = new StringBuilder(prompt1);

        for(int i=0;i<generateRequest.size();i++){
            promptBuilder.append("""
                슬라이드 번호 : %d
                슬라이드 핵심 내용 : %s
                사용자 발화 내용 : %s
                
                """.formatted(i, generateRequest.get(i).mainContext(), generateRequest.get(i).userSTT()));
        }


        String prompt = promptBuilder.append("""
                ---
                답변 형식 예시는 다음과 같다.
                
                JWT 인증방식이 자세하게 어떤건가요?|||JWT 인증은 로그인 성공 시 서버가 발급한 토큰을 클라이언트가 요청마다 함께 보내 사용자를 인증하는 방식입니다.
                """).toString();

        String content = chatClientBuilder.build()
                .prompt(prompt)
                .call()
                .content();

        return Arrays.stream(content.split("\\R"))
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .limit(10)
                .toList();
    }
}
