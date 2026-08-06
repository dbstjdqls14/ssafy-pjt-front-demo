package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.CompanyBest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CompanyBestRepository extends JpaRepository<CompanyBest, Long> {

    @Query("select companyBest from CompanyBest companyBest where companyBest.company.id in :companyIds order by companyBest.company.id asc, companyBest.id asc")
    List<CompanyBest> findAllByCompanyIds(@Param("companyIds") List<Long> companyIds);
}
