package com.ssafy.b109.aivo.media.entity;

public enum MediaDomain {
    INTERVIEW("interviews"),
    PRESENTATION("presentations");

    private final String path;

    MediaDomain(String path) {
        this.path = path;
    }

    public String path() {
        return path;
    }
}
