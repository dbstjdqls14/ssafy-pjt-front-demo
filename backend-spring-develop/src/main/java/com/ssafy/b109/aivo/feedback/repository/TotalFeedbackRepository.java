package com.ssafy.b109.aivo.feedback.repository;

import com.ssafy.b109.aivo.feedback.entity.TotalFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TotalFeedbackRepository extends JpaRepository<TotalFeedback, Long> {
    Optional<TotalFeedback> findByPracticeId(Long practiceId);
}
