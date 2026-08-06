package com.ssafy.b109.aivo.speech.repository;

import com.ssafy.b109.aivo.speech.entity.SpeechAnalysisLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpeechAnalysisLogRepository extends JpaRepository<SpeechAnalysisLog, Long> {

    List<SpeechAnalysisLog> findAllByPracticeIdOrderByCreatedAtAsc(Long practiceId);
}
