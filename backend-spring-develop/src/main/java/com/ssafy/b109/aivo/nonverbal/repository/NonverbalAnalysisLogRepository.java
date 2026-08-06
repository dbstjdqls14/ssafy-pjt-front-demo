package com.ssafy.b109.aivo.nonverbal.repository;

import com.ssafy.b109.aivo.nonverbal.entity.NonverbalAnalysisLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface NonverbalAnalysisLogRepository extends JpaRepository<NonverbalAnalysisLog, Long> {

    List<NonverbalAnalysisLog> findAllByPracticeIdOrderByCreatedAtAsc(Long practiceId);

    void deleteByPracticeIdAndEventTypeIn(Long practiceId, Collection<String> eventTypes);
}
