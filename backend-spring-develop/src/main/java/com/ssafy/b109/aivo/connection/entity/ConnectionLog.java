package com.ssafy.b109.aivo.connection.entity;

import com.ssafy.b109.aivo.practice.entity.Practice;
import com.ssafy.b109.aivo.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "connection_logs")
@IdClass(ConnectionLogId.class)
@Getter
@Setter
public class ConnectionLog {

    @Id
    @Column(name = "id", nullable = false)
    private Long id;

    @Id
    @Column(name = "practice_id", nullable = false)
    private Long practiceId;

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "practice_id", insertable = false, updatable = false, foreignKey = @ForeignKey(name = "FK_practices_TO_connection_logs_1"))
    private Practice practice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false, foreignKey = @ForeignKey(name = "FK_app_users_TO_connection_logs_1"))
    private User user;

    @Column(name = "connection_id")
    private String connectionId;

    @Column(name = "event_type", nullable = false, length = 30)
    private String eventType;

    @Column(name = "elapsed_time_ms")
    private Long elapsedTimeMs;

    @Column(name = "reason", columnDefinition = "text")
    private String reason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
