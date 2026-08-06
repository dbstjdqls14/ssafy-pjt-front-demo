package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.InterviewAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InterviewAnswerRepository extends JpaRepository<InterviewAnswer, Long> {

    List<InterviewAnswer> findAllByQuestionIdInOrderByIdAsc(List<Long> questionIds);
}
