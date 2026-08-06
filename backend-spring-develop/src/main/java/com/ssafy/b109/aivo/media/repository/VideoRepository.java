package com.ssafy.b109.aivo.media.repository;

import com.ssafy.b109.aivo.media.entity.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {
    Optional<Video> findByPracticeId(Long practiceId);
}
