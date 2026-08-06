package com.ssafy.b109.aivo.presentation.repository;

import com.ssafy.b109.aivo.presentation.entity.Presentation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

@Repository
public interface PresentationRepository extends JpaRepository<Presentation, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""                                                                                                                                                            
          select p                                                                                                                                                      
          from Presentation p                                                                                                                                           
          where p.id = :presentationId                                                                                                                                  
          """)
    Optional<Presentation> findByIdForUpdate(
            @Param("presentationId")
            Long presentationId
    );
}
