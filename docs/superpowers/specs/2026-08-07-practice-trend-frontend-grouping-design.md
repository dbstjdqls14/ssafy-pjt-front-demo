# Practice Trend Frontend Grouping Design

## Goal

백엔드 `GET /api/v1/practices/trends` 응답은 변경하지 않고, 프런트가 백엔드의 절반 분할 규칙과 동일하게 이전/최근 구간을 해석한다.

## Confirmed contract

- 백엔드는 분석 가능한 최근 기록을 2개, 4개, 6개 단위로 반환한다.
- `earlyTrend`와 `lateTrend`는 반환된 `practices` 배열의 앞 절반과 뒤 절반을 각각 집계한 값이다.
- 따라서 프런트의 구간은 `2 -> 1:1`, `4 -> 2:2`, `6 -> 3:3`이다.
- 백엔드 응답 필드는 추가하거나 변경하지 않는다.

## Frontend design

`normalizePracticeTrends`가 반환된 기록 수의 절반을 `previousCount`, 나머지 절반을 `recentCount`로 계산한다. 두 구간이 모두 존재하고 `earlyTrend`, `lateTrend`가 모두 있을 때 비교 분석을 활성화한다.

화면은 정규화된 두 count만 사용한다. 비교 설명, 그래프 구간, 하단 구간 라벨을 실제 개수로 표시하며 `최근 3회`, `이전 3회`를 하드코딩하지 않는다.

## Edge cases

- 응답이 없거나 1개뿐이면 비교 분석을 잠근다.
- `earlyTrend` 또는 `lateTrend`가 없으면 기록 수가 충분해도 집계 중 상태를 유지한다.
- 6개를 초과한 응답은 기존처럼 최신 6개만 사용한다.
- 홀수 길이 응답은 현재 백엔드 정상 계약에는 없지만, 앞 구간을 `floor(n / 2)`, 최근 구간을 나머지로 처리하여 데이터가 유실되지 않게 한다.

## Verification

- 정규화 테스트에서 2개는 1:1, 4개는 2:2, 6개는 3:3을 검증한다.
- 화면 테스트에서 2개와 유효한 두 trend가 있으면 잠금이 해제되고 실제 구간 문구가 표시되는지 검증한다.
- 관련 Vitest와 프로덕션 빌드를 실행한다.
