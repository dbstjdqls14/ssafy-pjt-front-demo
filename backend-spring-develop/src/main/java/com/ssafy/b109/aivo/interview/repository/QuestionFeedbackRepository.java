package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.QuestionFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface QuestionFeedbackRepository extends JpaRepository<QuestionFeedback, Long> {

    Optional<QuestionFeedback> findFirstByInterviewIdAndQuestionIdOrderByCreatedAtDescIdDesc(Long interviewId, Long questionId);
}
