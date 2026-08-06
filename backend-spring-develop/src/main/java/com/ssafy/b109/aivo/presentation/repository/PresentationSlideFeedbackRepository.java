package com.ssafy.b109.aivo.presentation.repository;

import com.ssafy.b109.aivo.presentation.entity.PresentationSlideFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PresentationSlideFeedbackRepository
        extends JpaRepository<PresentationSlideFeedback, Long> {

    Optional<PresentationSlideFeedback> findBySlideId(Long slideId);
}
