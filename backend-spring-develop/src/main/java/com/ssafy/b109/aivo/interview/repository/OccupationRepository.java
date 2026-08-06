package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.Occupation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OccupationRepository extends JpaRepository<Occupation, Long> {

    List<Occupation> findAllByOrderByIdAsc();
}
