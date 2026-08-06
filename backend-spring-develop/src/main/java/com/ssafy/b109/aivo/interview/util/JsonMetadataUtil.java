package com.ssafy.b109.aivo.interview.util;

public final class JsonMetadataUtil {

    private JsonMetadataUtil() {
    }

    public static int extractInt(String metadata, String key) {
        if (metadata == null || metadata.isBlank()) {
            return 0;
        }

        String token = "\"" + key + "\":";
        int start = metadata.indexOf(token);
        if (start < 0) {
            return 0;
        }

        int valueStart = start + token.length();
        while (valueStart < metadata.length() && Character.isWhitespace(metadata.charAt(valueStart))) {
            valueStart++;
        }

        int valueEnd = valueStart;
        while (valueEnd < metadata.length() && Character.isDigit(metadata.charAt(valueEnd))) {
            valueEnd++;
        }
        if (valueStart == valueEnd) {
            return 0;
        }

        return Integer.parseInt(metadata.substring(valueStart, valueEnd));
    }

    public static boolean extractBoolean(String metadata, String key) {
        if (metadata == null || metadata.isBlank()) {
            return false;
        }

        String token = "\"" + key + "\":";
        int start = metadata.indexOf(token);
        if (start < 0) {
            return false;
        }

        int valueStart = start + token.length();
        while (valueStart < metadata.length() && Character.isWhitespace(metadata.charAt(valueStart))) {
            valueStart++;
        }

        return metadata.startsWith("true", valueStart);
    }
}
