import { computed, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { formatTiltPercent, useGestureGraph } from '../../src/composables/useGestureGraph.js'

describe('useGestureGraph', () => {
  it('formats hover tilt values to one decimal place', () => {
    expect(formatTiltPercent(17.84016393442623)).toBe('17.8')
    expect(formatTiltPercent(undefined)).toBe('0.0')
  })

  it('places gaze events on the same interpolated line used by the graph', async () => {
    const series = ref({
      buckets: [
        { startSec: 0, endSec: 10, tiltPercent: 10 },
        { startSec: 10, endSec: 20, tiltPercent: 30 },
        { startSec: 20, endSec: 30, tiltPercent: 20 },
      ],
      gazeEvents: [{ atSec: 5 }, { atSec: 15 }, { atSec: 25 }],
    })
    const duration = ref(30)
    const graph = useGestureGraph(computed(() => series.value), computed(() => duration.value))
    await nextTick()

    expect(graph.tiltLinePath.value).toContain('M0,')
    expect(graph.tiltLinePath.value).toContain('L300,')
    expect(graph.tiltLinePath.value).toContain('L600,')
    graph.gazeDotPositions.value.forEach((dot) => {
      expect(dot.yPct).toBeCloseTo(graph.tiltYFor(graph.tiltValueAtSec(dot.atSec)))
    })
  })
})
