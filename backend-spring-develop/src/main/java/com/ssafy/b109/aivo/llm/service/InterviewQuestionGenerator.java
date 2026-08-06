package com.ssafy.b109.aivo.llm.service;

import com.ssafy.b109.aivo.interview.dto.InterviewStartRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InterviewQuestionGenerator {

    private final ChatClient.Builder chatClientBuilder;

    public List<String> generate(
            InterviewStartRequest request,
            String companyName,
            String occupationName,
            String jobName,
            String interviewerName,
            List<String> companyBestContents,
            String portfolioContext,
            String resumeContext
    ) {
        String prompt = """
                한국어 모의 면접 질문 10개만 생성해.
                출력은 번호 없이 질문만 줄바꿈으로 작성해.
                아래 정보 중 '선택하지 않음'인 항목은 억지로 반영하지 말고, 선택된 항목만 자연스럽게 반영해.
                기업 인재상이 있으면 질문의 평가 기준과 상황 질문에 반영해.

                면접 제목: %s
                회사: %s
                직군: %s
                직무: %s
                경력: %s
                면접관 스타일: %s
                기업 인재상:
                %s

                포트폴리오 요약:
                %s

                이력서/자소서 본문:
                %s
                """.formatted(
                valueOrNotSelected(request.title()),
                valueOrNotSelected(companyName),
                valueOrNotSelected(occupationName),
                valueOrNotSelected(jobName),
                valueOrNotSelected(request.workExperience()),
                valueOrNotSelected(interviewerName),
                listOrNotSelected(companyBestContents),
                valueOrNotSelected(portfolioContext),
                valueOrNotSelected(resumeContext)
        );

        String content = chatClientBuilder.build()
                .prompt(prompt)
                .call()
                .content();

        return Arrays.stream(content.split("\\R"))
                .map(line -> line.replaceFirst("^\\s*\\d+[.)]\\s*", "").trim())
                .filter(line -> !line.isBlank())
                .limit(10)
                .toList();
    }

    private String valueOrNotSelected(String value) {
        return value == null || value.isBlank() ? "선택하지 않음" : value;
    }

    private String listOrNotSelected(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "선택하지 않음";
        }
        return String.join("\n", values);
    }
}
