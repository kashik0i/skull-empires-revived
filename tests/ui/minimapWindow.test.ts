import { describe, it, expect } from 'bun:test'
import { focusedWindow } from '../../src/ui/minimapWindow'

describe('focusedWindow', () => {
  it('centers on hero away from edges', () => {
    const w = focusedWindow({ x: 20, y: 20 }, 60, 60, 8)
    expect(w).toEqual({ x0: 12, y0: 12, x1: 28, y1: 28, width: 17, height: 17 })
  })

  it('clamps left+top against floor edge', () => {
    const w = focusedWindow({ x: 2, y: 1 }, 60, 60, 8)
    expect(w.x0).toBe(0)
    expect(w.y0).toBe(0)
    expect(w.x1).toBe(8 + 2)  // hero_x + radius
    expect(w.y1).toBe(8 + 1)
  })

  it('clamps right+bottom against floor edge', () => {
    const w = focusedWindow({ x: 58, y: 59 }, 60, 60, 8)
    expect(w.x1).toBe(59)  // floorW - 1
    expect(w.y1).toBe(59)
  })

  it('reports inclusive width/height', () => {
    const w = focusedWindow({ x: 20, y: 20 }, 60, 60, 8)
    expect(w.width).toBe(w.x1 - w.x0 + 1)
    expect(w.height).toBe(w.y1 - w.y0 + 1)
  })
})
