package com.ssafy.b109.aivo.resume.repository;

import com.ssafy.b109.aivo.resume.entity.Resume;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResumeRepository extends JpaRepository<Resume, Long> {

    List<Resume> findAllByUserIdAndDeletedAtIsNullOrderByIdDesc(Long userId);

    Optional<Resume> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    List<Resume> findAllByIdInAndUserIdAndDeletedAtIsNull(List<Long> ids, Long userId);
}
