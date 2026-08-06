package com.ssafy.b109.aivo.presentation.repository;

import com.ssafy.b109.aivo.presentation.entity.PresentationQuestionFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PresentationQuestionFeedbackRepository extends JpaRepository<PresentationQuestionFeedback, Long> {
    Optional<PresentationQuestionFeedback> findByQuestionId(Long questionId);
    List<PresentationQuestionFeedback> findByQuestionIdInOrderByQuestionIdAsc(List<Long> questionIds);
}
