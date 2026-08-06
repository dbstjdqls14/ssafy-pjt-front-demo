package com.ssafy.b109.aivo.practice.repository;

import com.ssafy.b109.aivo.practice.entity.Practice;
import com.ssafy.b109.aivo.presentation.entity.PresentationProcessingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PracticeRepository extends JpaRepository<Practice, Long> {
    Optional<Practice> findByPresentationId(Long presentationId);
    @Query("""
        select count(p) > 0
        from Practice p
        where p.presentation.id = :presentationId
        and p.folder.user.id = :userId
    """)
    boolean existsOwnedPresentation(
            @Param("presentationId")
            Long presentationId,

            @Param("userId")
            Long userId
    );

    Optional<Practice> findByInterviewSession_IdAndFolder_User_Id(Long interviewId, Long userId);

    Optional<Practice> findByIdAndFolder_User_Id(Long presentationId, Long userId);

    Optional<Practice> findByInterviewSession_Id(Long interviewId);

    long countByFolder_Id(Long folderId);
    Optional<Practice> findByPresentation_IdAndFolder_IdAndFolder_User_Id(Long presentationId, Long folderId, Long userId);
    Optional<Practice> findByPresentation_IdAndFolder_User_Id(Long presentationId, Long userId);

    @Query("""                                                                                                                                                                                                                                                                                                        
      select practice                                                                                                                                                                                                                                                                                               
      from Practice practice                                                                                                                                                                                                                                                                                        
      join fetch practice.presentation presentation                                                                                                                                                                                                                                                                 
      where practice.folder.id = :folderId                                                                                                                                                                                                                                                                          
        and practice.folder.user.id = :userId                                                                                                                                                                                                                                                                       
        and presentation.processingStatus = :status                                                                                                                                                                                                                                                                 
      order by practice.createdAt desc                                                                                                                                                                                                                                                                              
  """)
    List<Practice> findReusablePresentationPractices(
            @Param("folderId") Long folderId,
            @Param("userId") Long userId,
            @Param("status")
            PresentationProcessingStatus status
    );
}
