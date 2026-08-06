package com.ssafy.b109.aivo.interview.repository;

import com.ssafy.b109.aivo.interview.entity.InterviewerQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InterviewerQuestionRepository extends JpaRepository<InterviewerQuestion, Long> {

    List<InterviewerQuestion> findAllByInterviewerIdOrderByDisplayOrderAsc(Long interviewerId);

    @Query("select interviewerQuestion from InterviewerQuestion interviewerQuestion where interviewerQuestion.interviewer.id in :ids order by interviewerQuestion.interviewer.id asc, interviewerQuestion.id asc")
    List<InterviewerQuestion> findAllByInterviewerIds(@Param("ids") List<Long> ids);
}
