package com.ssafy.b109.aivo.rabbitmq.repository;

import com.ssafy.b109.aivo.rabbitmq.entity.RabbitmqEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RabbitmqEventRepository extends JpaRepository<RabbitmqEvent, Long> {
}
