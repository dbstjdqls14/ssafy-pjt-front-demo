package com.ssafy.b109.aivo.media.entity;

import com.ssafy.b109.aivo.practice.entity.Practice;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Fetch;

import java.time.LocalDateTime;

@Entity
@Table(name = "audios")
@Getter
@Setter
public class Audio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;


    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "practice_id", nullable = false)
    private Practice practice;

    @Column(name = "path", nullable = false, columnDefinition = "text")
    private String path;

    @Column(name = "type", nullable = false, length = 50)
    private String type;

    @Column(name = "size", nullable = false)
    private Long size;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
