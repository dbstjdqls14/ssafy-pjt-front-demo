package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobRepository extends JpaRepository<Job, Long> {

    List<Job> findAllByOccupationIdOrderByIdAsc(Long occupationId);
}
