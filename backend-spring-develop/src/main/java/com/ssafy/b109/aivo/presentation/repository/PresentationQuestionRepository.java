package com.ssafy.b109.aivo.presentation.repository;

import com.ssafy.b109.aivo.presentation.entity.PresentationQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PresentationQuestionRepository extends JpaRepository<PresentationQuestion, Long> {
    List<PresentationQuestion> findByPresentationIdOrderByIdAsc(Long presentationId);
}
