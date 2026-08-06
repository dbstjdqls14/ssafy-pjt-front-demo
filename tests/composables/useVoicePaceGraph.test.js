import { computed, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useVoicePaceGraph } from '../../src/composables/useVoicePaceGraph.js'

describe('useVoicePaceGraph', () => {
  it('keeps every SVG x coordinate inside the chart when analysis timestamps exceed the media duration', async () => {
    const voicePace = ref({
      avgPace: 14.1,
      buckets: [{ startSec: 13.4, endSec: 14.7, pace: 14.1 }],
      slowest: { startSec: 13.4, endSec: 14.7, pace: 14.1 },
      fastest: { startSec: 13.4, endSec: 14.7, pace: 14.1 },
    })
    const durationSec = ref(1)
    const graph = useVoicePaceGraph(
      computed(() => voicePace.value),
      computed(() => durationSec.value),
    )
    await nextTick()

    const xCoordinates = [...graph.paceChartPath.value.matchAll(/[ML](-?\d+(?:\.\d+)?),/g)]
      .map((match) => Number(match[1]))

    expect(xCoordinates.length).toBeGreaterThan(0)
    expect(xCoordinates.every((x) => x >= 0 && x <= 600)).toBe(true)
  })
})
