package com.ssafy.b109.aivo.presentation.repository;

import com.ssafy.b109.aivo.presentation.entity.PresentationSlide;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PresentationSlideRepository
        extends JpaRepository<PresentationSlide, Long> {

    List<PresentationSlide> findAllByPresentationIdOrderBySlideNumber(
            Long presentationId
    );

    Optional<PresentationSlide> findByPresentationIdAndSlideNumber(
            Long presentationId,
            Integer slideNumber
    );

    void deleteAllByPresentationId(Long presentationId);

    boolean existsByPresentationIdAndSlideNumber(
            Long presentationId,
            Integer slideNumber
    );
    List<PresentationSlide> findByPresentationId(Long presentationId);

    Optional<PresentationSlide>
    findByIdAndPresentationId(Long slideId, Long presentationId);
}