package com.ssafy.b109.aivo.llm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.interview.dto.InterviewAnswerSubmitRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewContentEvaluationResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewReportResponse;
import com.ssafy.b109.aivo.interview.dto.NonverbalSummaryResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionEvaluationResponse;
import com.ssafy.b109.aivo.interview.entity.Interview;
import com.ssafy.b109.aivo.interview.entity.InterviewQuestion;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewReportGenerator {

    private static final int MAX_ANSWER_CONTEXT_LENGTH = 12_000;
    private static final String NOT_SELECTED = "선택되지 않음";

    private final ChatClient.Builder chatClientBuilder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public InterviewReportResponse generate(
            Interview interview,
            Long practiceId,
            String companyName,
            String occupationName,
            String jobName,
            List<String> companyBestContents,
            NonverbalSummaryResponse nonverbalSummary,
            List<InterviewQuestion> questions,
            List<InterviewAnswerSubmitRequest> answers
    ) {
        String content = chatClientBuilder.build()
                .prompt(buildPrompt(
                        interview,
                        companyName,
                        occupationName,
                        jobName,
                        companyBestContents,
                        nonverbalSummary,
                        questions,
                        answers
                ))
                .call()
                .content();

        try {
            LlmReportResponse parsed = objectMapper.readValue(extractJson(content), LlmReportResponse.class);
            return parsed.toResponse(interview.getId(), practiceId, interview.getTitle(), nonverbalSummary);
        } catch (Exception exception) {
            log.warn("Failed to parse LLM interview report: {}", exception.getMessage());
            throw new CustomException(ErrorCode.REPORT_GENERATION_FAILED);
        }
    }

    private String buildPrompt(
            Interview interview,
            String companyName,
            String occupationName,
            String jobName,
            List<String> companyBestContents,
            NonverbalSummaryResponse nonverbalSummary,
            List<InterviewQuestion> questions,
            List<InterviewAnswerSubmitRequest> answers
    ) {
        return """
                너는 채용 면접관이자 커리어 코치다.
                아래 모의 면접 데이터를 바탕으로 질문별 답변 평가와 종합 리포트를 생성하라.
                반드시 JSON 객체 하나만 반환하고, 마크다운 코드블록/설명/주석은 넣지 마라.

                평가 기준:
                - 모든 점수는 0~100 정수로 산정한다.
                - 질문별 feedback과 improvement는 해당 질문/답변 내용에 근거해 작성한다.
                - 선택되지 않은 회사/직군/직무/기업 인재상은 평가 근거로 사용하지 않는다.
                - 값이 있는 회사/직군/직무/인재상은 질문 맥락과 답변 적합성 평가에 반영한다.
                - 비언어 통계는 deliveryScore와 detailedFeedback에 반영한다.
                - 답변이 비어 있으면 낮은 점수와 구체적인 보완 방향을 제시한다.

                반환 JSON schema:
                {
                  "overallScore": 0,
                  "contentEvaluation": {
                    "relevanceScore": 0,
                    "structureScore": 0,
                    "clarityScore": 0,
                    "deliveryScore": 0,
                    "feedback": "전체 답변 내용 평가"
                  },
                  "questionEvaluations": [
                    {
                      "questionId": 1,
                      "question": "질문",
                      "answer": "답변",
                      "score": 0,
                      "feedback": "답변의 강점과 문제점",
                      "improvement": "다음 답변에서 바로 고칠 구체적 개선안",
                      "problem": "가장 큰 문제 한 문장",
                      "issueLabel": "짧은 이슈 라벨"
                    }
                  ],
                  "strengths": ["강점"],
                  "improvements": ["개선점"],
                  "detailedFeedback": "종합 피드백"
                }

                면접 제목: %s
                회사: %s
                직군: %s
                직무: %s
                경력: %s
                면접관 스타일: %s
                기업 인재상:
                %s

                비언어 음성 누적 통계:
                - 분석 청크 수: %d
                - 추임새 총 횟수: %d
                - 침묵 감지 횟수: %d
                - 말더듬 감지 횟수: %d
                - 평균 WPM: %d

                생성된 면접 질문:
                %s

                제출된 질문/답변:
                %s
                """.formatted(
                valueOrNotSelected(interview.getTitle()),
                valueOrNotSelected(companyName),
                valueOrNotSelected(occupationName),
                valueOrNotSelected(jobName),
                valueOrNotSelected(interview.getWorkExperience()),
                interview.getInterviewer() == null ? NOT_SELECTED : valueOrNotSelected(interview.getInterviewer().getName()),
                listOrNotSelected(companyBestContents),
                nonverbalSummary.analyzedChunks(),
                nonverbalSummary.totalFillerCount(),
                nonverbalSummary.silenceCount(),
                nonverbalSummary.stutterCount(),
                nonverbalSummary.averageWpm(),
                buildQuestionContext(questions),
                buildAnswerContext(answers)
        );
    }

    private String buildQuestionContext(List<InterviewQuestion> questions) {
        if (questions == null || questions.isEmpty()) {
            return "생성된 질문 없음";
        }

        return questions.stream()
                .map(question -> "- questionId=%d, question=%s".formatted(
                        question.getId(),
                        valueOrNotSelected(question.getQuestion())
                ))
                .reduce((left, right) -> left + "\n" + right)
                .orElse("생성된 질문 없음");
    }

    private String buildAnswerContext(List<InterviewAnswerSubmitRequest> answers) {
        if (answers == null || answers.isEmpty()) {
            return "제출된 답변 없음";
        }

        String context = answers.stream()
                .map(answer -> "- questionId=%s%nQ. %s%nA. %s".formatted(
                        answer.questionId() == null ? "null" : answer.questionId(),
                        valueOrNotSelected(answer.question()),
                        valueOrNotSelected(answer.answer())
                ))
                .reduce((left, right) -> left + "\n\n" + right)
                .orElse("제출된 답변 없음");

        return context.length() > MAX_ANSWER_CONTEXT_LENGTH
                ? context.substring(0, MAX_ANSWER_CONTEXT_LENGTH)
                : context;
    }

    private String extractJson(String content) {
        if (content == null || content.isBlank()) {
            throw new CustomException(ErrorCode.REPORT_GENERATION_FAILED);
        }

        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "").trim();
        }

        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start < 0 || end < start) {
            throw new CustomException(ErrorCode.REPORT_GENERATION_FAILED);
        }
        return trimmed.substring(start, end + 1);
    }

    private String valueOrNotSelected(String value) {
        return value == null || value.isBlank() ? NOT_SELECTED : value;
    }

    private String listOrNotSelected(List<String> values) {
        if (values == null || values.isEmpty()) {
            return NOT_SELECTED;
        }
        return String.join("\n", values);
    }

    private record LlmReportResponse(
            Integer overallScore,
            InterviewContentEvaluationResponse contentEvaluation,
            List<QuestionEvaluationResponse> questionEvaluations,
            List<String> strengths,
            List<String> improvements,
            String detailedFeedback
    ) {

        private InterviewReportResponse toResponse(
                Long interviewId,
                Long practiceId,
                String title,
                NonverbalSummaryResponse nonverbalSummary
        ) {
            return new InterviewReportResponse(
                    interviewId,
                    practiceId,
                    valueOrEmpty(title),
                    null,
                    clamp(overallScore),
                    null,
                    List.of(),
                    null,
                    null,
                    nonverbalSummary,
                    contentEvaluation == null
                            ? new InterviewContentEvaluationResponse(0, 0, 0, 0, "")
                            : contentEvaluation,
                    questionEvaluations == null ? List.of() : questionEvaluations,
                    questionEvaluations == null ? List.of() : questionEvaluations,
                    null,
                    null,
                    null,
                    strengths == null ? List.of() : strengths,
                    improvements == null ? List.of() : improvements,
                    detailedFeedback == null ? "" : detailedFeedback
            );
        }

        private int clamp(Integer score) {
            if (score == null) {
                return 0;
            }
            return Math.max(0, Math.min(100, score));
        }

        private String valueOrEmpty(String value) {
            return value == null ? "" : value;
        }
    }
}
