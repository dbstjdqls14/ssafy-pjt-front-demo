package com.ssafy.b109.aivo.practice.repository;

import com.ssafy.b109.aivo.practice.entity.PracticeFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PracticeFolderRepository extends JpaRepository<PracticeFolder, Long> {

    Optional<PracticeFolder> findFirstByUserIdAndNameOrderByIdAsc(Long userId, String name);

    Optional<PracticeFolder> findByIdAndUserId(Long folderId, Long userId);

    List<PracticeFolder> findAllByUserIdOrderByIdDesc(Long userId);

    List<PracticeFolder> findAllByUserIdAndNameContainingIgnoreCaseOrderByIdDesc(Long userId, String keyword);
}
