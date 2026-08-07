import { describe, expect, test } from 'vitest'

import { routes } from '../src/router/routes.js'

const joinPath = (parentPath, path) => {
  if (path.startsWith('/')) return path
  if (!parentPath || parentPath === '/') return `/${path}`
  return `${parentPath.replace(/\/$/, '')}/${path}`
}

const flattenRoutes = (routeList, parentPath = '', parentMeta = {}) =>
  routeList.flatMap((route) => {
    const path = joinPath(parentPath, route.path)
    const normalized = {
      ...route,
      path,
      meta: { ...parentMeta, ...route.meta },
    }

    return [normalized, ...flattenRoutes(route.children ?? [], path, normalized.meta)]
  })

const flattenedRoutes = flattenRoutes(routes)
const leafRoutes = flattenedRoutes.filter((route) => !route.children?.length)

describe('router routes', () => {
  test('every resolved route has a unique path and name', () => {
    const paths = leafRoutes.map((route) => route.path)
    const names = leafRoutes.map((route) => route.name)

    expect(new Set(paths).size).toBe(paths.length)
    expect(names.every(Boolean)).toBe(true)
    expect(new Set(names).size).toBe(names.length)
  })

  test('every leaf route lazy-loads a component and satisfies the shared meta contract', () => {
    for (const route of leafRoutes) {
      expect(typeof route.component).toBe('function')
      expect(['default', 'immersive']).toContain(route.meta?.layout)
      expect(typeof route.meta?.area).toBe('string')
      expect(route.meta.area.length).toBeGreaterThan(0)
      expect(typeof route.meta?.title).toBe('string')
      expect(route.meta.title.length).toBeGreaterThan(0)
      expect(typeof route.meta?.bodyClass).toBe('string')
      expect(route.meta.bodyClass.length).toBeGreaterThan(0)
    }
  })

  test('no route uses the removed legacy layout', () => {
    expect(flattenedRoutes.some((route) => route.meta?.layout === 'legacy')).toBe(false)
  })

  test('presentation flow has all 8 steps with a bodyClass', () => {
    const presentation = leafRoutes.filter((route) => route.path.startsWith('/presentation/'))
    expect(presentation).toHaveLength(8)
    for (const route of presentation) {
      expect(route.meta.bodyClass).toBeTruthy()
    }
  })

  test('wizard shell metadata is limited to setup steps', () => {
    expect(leafRoutes.filter((route) => route.meta.flow === 'presentation')).toHaveLength(4)
    expect(leafRoutes.filter((route) => route.meta.flow === 'interview')).toHaveLength(5)
  })

  test('mypage routes require auth', () => {
    const mypage = leafRoutes.filter((route) => route.path.startsWith('/mypage'))
    expect(mypage.length).toBeGreaterThan(0)
    for (const route of mypage) {
      expect(route.meta.requiresAuth).toBe(true)
    }
  })
})
