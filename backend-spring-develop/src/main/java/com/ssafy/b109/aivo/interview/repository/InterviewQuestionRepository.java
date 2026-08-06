package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.InterviewQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InterviewQuestionRepository extends JpaRepository<InterviewQuestion, Long> {

    List<InterviewQuestion> findAllByInterviewIdOrderByIdAsc(Long interviewId);

    Optional<InterviewQuestion> findByIdAndInterviewId(Long id, Long interviewId);

    boolean existsByIdAndInterviewId(Long id, Long interviewId);
}
