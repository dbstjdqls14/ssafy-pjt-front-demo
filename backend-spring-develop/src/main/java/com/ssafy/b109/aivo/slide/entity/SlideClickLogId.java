package com.ssafy.b109.aivo.slide.entity;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@EqualsAndHashCode
public class SlideClickLogId implements Serializable {

    private Long id;
    private Long practiceId;
}
