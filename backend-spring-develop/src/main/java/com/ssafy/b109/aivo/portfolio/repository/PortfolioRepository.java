package com.ssafy.b109.aivo.portfolio.repository;

import com.ssafy.b109.aivo.portfolio.entity.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioRepository extends JpaRepository<Portfolio, Long> {

    List<Portfolio> findAllByUserIdAndDeletedAtIsNullOrderByIdDesc(Long userId);

    Optional<Portfolio> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    List<Portfolio> findAllByIdInAndUserIdAndDeletedAtIsNull(List<Long> ids, Long userId);
}
