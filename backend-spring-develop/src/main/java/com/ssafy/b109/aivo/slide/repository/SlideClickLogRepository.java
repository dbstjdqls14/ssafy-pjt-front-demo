package com.ssafy.b109.aivo.slide.repository;

import com.ssafy.b109.aivo.slide.entity.SlideClickLog;
import com.ssafy.b109.aivo.slide.entity.SlideClickLogId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SlideClickLogRepository extends JpaRepository<SlideClickLog, SlideClickLogId> {
    boolean existsByPracticeId(
            Long practiceId
    );

    Optional<SlideClickLog>
    findTopByPracticeIdOrderByIdDesc(
            Long practiceId
    );

    List<SlideClickLog>
    findAllByPracticeIdOrderByOccurredTimeMsAsc(
            Long practiceId
    );
}
