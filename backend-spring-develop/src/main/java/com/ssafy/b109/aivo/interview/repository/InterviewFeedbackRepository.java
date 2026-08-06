package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.InterviewFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InterviewFeedbackRepository extends JpaRepository<InterviewFeedback, Long> {

    Optional<InterviewFeedback> findFirstByInterviewIdOrderByCreatedAtDescIdDesc(Long interviewId);
}
