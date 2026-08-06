package com.ssafy.b109.aivo.media.repository;

import com.ssafy.b109.aivo.media.entity.Audio;
import com.ssafy.b109.aivo.practice.entity.Practice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AudioRepository extends JpaRepository<Audio, Long> {
    Optional<Audio> findByPractice(Practice practice);
    Optional<Audio> findByPracticeId(Long practiceId);
}
