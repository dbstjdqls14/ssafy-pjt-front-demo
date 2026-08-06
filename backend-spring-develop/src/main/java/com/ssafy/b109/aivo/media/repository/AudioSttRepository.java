package com.ssafy.b109.aivo.media.repository;

import com.ssafy.b109.aivo.media.entity.Audio;
import com.ssafy.b109.aivo.media.entity.AudioStt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AudioSttRepository extends JpaRepository<AudioStt, Long> {
    Optional<AudioStt> findByAudio(Audio audio);
    Optional<AudioStt> findFirstByAudioIdOrderByIdDesc(Long audioId);
}
