package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {

    List<Company> findAllByOrderByIdAsc();
}
