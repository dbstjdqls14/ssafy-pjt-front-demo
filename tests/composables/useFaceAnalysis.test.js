import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'

import { useFaceAnalysis } from '../../src/composables/useFaceAnalysis.js'

describe('useFaceAnalysis', () => {
  it('returns the nonverbal summary contract used by interview completion', () => {
    const scope = effectScope()
    let analysis

    scope.run(() => {
      analysis = useFaceAnalysis()
    })

    expect(analysis.getSessionSummary()).toEqual({
      gazeDeviationCount: 0,
      postureTiltPercent: null,
      sampleCount: 0,
      gazeEvents: [],
      tiltBuckets: [],
    })
    expect(analysis.getSessionSummary()).not.toHaveProperty('gazeStablePercent')
    expect(analysis.gazeFrontal.value).toBeNull()
    expect(analysis.postureTilted.value).toBeNull()
    expect(analysis.prepare).toBeTypeOf('function')

    scope.stop()
  })
})
