import { describe, expect, test } from 'vitest'

import { presentationRoutes } from '../../src/router/modules/presentationRoutes.js'

describe('presentation outcome routes', () => {
  test('uses an analyzing route and no longer exposes the temporary artifacts page', () => {
    expect(presentationRoutes.some((route) => route.path === '/presentation/analyzing')).toBe(true)
    expect(presentationRoutes.some((route) => route.path === '/presentation/artifacts')).toBe(false)
  })
})
