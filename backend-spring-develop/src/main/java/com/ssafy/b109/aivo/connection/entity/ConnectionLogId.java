package com.ssafy.b109.aivo.connection.entity;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@EqualsAndHashCode
public class ConnectionLogId implements Serializable {

    private Long id;
    private Long practiceId;
    private Long userId;
}
