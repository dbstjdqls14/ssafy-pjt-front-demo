package com.ssafy.b109.aivo.presentation.dto;

import java.net.URI;

public record PresentationSlideResponse (
    Long slideId,
    Integer slideNumber,
    URI imageUrl,
    String description
){

}
