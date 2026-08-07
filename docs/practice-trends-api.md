# Unified practice trends API

The My Page growth view uses one authenticated endpoint for completed presentation and interview practices.

```http
GET /api/v1/practices/trends
Authorization: Bearer <access-token>
```

No query parameter or client-side practice-type filter is used.

## Response contract

```json
{
  "earlyTrend": {
    "content": 82,
    "stability": 71,
    "glance": 2.0,
    "filler": 1.4,
    "speed": 11.2,
    "totalTime": 5.2
  },
  "lateTrend": {
    "content": 91,
    "stability": 68,
    "glance": 1.3,
    "filler": 0.8,
    "speed": 14.8,
    "totalTime": 3.4
  },
  "practices": [
    {
      "contentScore": 90,
      "videoScore": 80,
      "voiceScore": 80
    }
  ],
  "speech": {
    "averageSpeechSpeed": 137,
    "earlySpeechSpeed": 122,
    "lateSpeechSpeed": 152,
    "silenceLate": 4.2
  }
}
```

## Ordering and units

- `earlyTrend` is the aggregate for the three practices immediately before the latest three.
- `lateTrend` is the aggregate for the latest three completed practices.
- `practices` is ordered oldest to newest and contains at most the six practices represented by those two groups.
- `content` and `stability` are scores where higher is better.
- `glance` and `filler` are events per minute where lower is better.
- `speed`, `totalTime`, and `silenceLate` are percentages where lower is better.
- `averageSpeechSpeed`, `earlySpeechSpeed`, and `lateSpeechSpeed` are WPM values.
- Missing values must be `null` or omitted. They must not be encoded as zero.

When fewer than six completed practices exist, the frontend shows the available recent scores and an insufficient-history state for the previous group. API errors are shown with a retry action; there is no mock-data fallback.
