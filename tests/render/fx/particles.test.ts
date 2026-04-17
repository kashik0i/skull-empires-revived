import { describe, it, expect } from 'bun:test'
import { createParticles, type EmitterSpec } from '../../../src/render/fx/particles'

describe('particle pool', () => {
  it('emits particles from a preset and ages them out', () => {
    const pool = createParticles({ capacity: 100 })
    const spec: EmitterSpec = {
      count: 10,
      origin: { x: 5, y: 5 },
      speed: [50, 100],
      angleRange: [0, Math.PI * 2],
      lifeMs: 200,
      sizePx: [2, 4],
      color: '#ffffff',
      gravity: 0,
    }
    pool.emit(spec)
    expect(pool.aliveCount()).toBe(10)
    pool.tick(100)
    expect(pool.aliveCount()).toBe(10)
    pool.tick(200)
    expect(pool.aliveCount()).toBe(0)
  })

  it('recycles slots when capacity exceeded', () => {
    const pool = createParticles({ capacity: 5 })
    pool.emit({
      count: 10, origin: { x: 0, y: 0 }, speed: [10, 10], angleRange: [0, 0],
      lifeMs: 1000, sizePx: [1, 1], color: '#fff', gravity: 0,
    })
    expect(pool.aliveCount()).toBe(5)
  })

  it('positions advance by velocity each tick', () => {
    const pool = createParticles({ capacity: 10 })
    pool.emit({
      count: 1, origin: { x: 0, y: 0 }, speed: [100, 100], angleRange: [0, 0],
      lifeMs: 1000, sizePx: [1, 1], color: '#fff', gravity: 0,
    })
    const before = pool.snapshot()[0]
    pool.tick(100)
    const after = pool.snapshot()[0]
    expect(after.x).toBeGreaterThan(before.x)
  })
})
