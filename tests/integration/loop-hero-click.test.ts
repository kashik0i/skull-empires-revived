import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { createLoop } from '../../src/loop'
import { createFxBus } from '../../src/render/fx/bus'
import { intentForClick } from '../../src/input/intent'
import { Tile, type Pos } from '../../src/core/types'

/**
 * Mock rAF + performance.now for deterministic loop simulation.
 * Each call to advance(ms) drives the rAF queue forward by ms.
 */
function mockTimer() {
  let now = 1000
  type Cb = (t: number) => void
  let pending: Cb[] = []
  const origRaf = globalThis.requestAnimationFrame
  const origPerf = globalThis.performance
  ;(globalThis as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = ((cb: Cb): number => {
    pending.push(cb)
    return pending.length
  }) as typeof requestAnimationFrame
  ;(globalThis as { performance: Performance }).performance = { now: () => now } as Performance
  return {
    advance(ms: number, frameStep = 16): void {
      const target = now + ms
      while (now < target) {
        now = Math.min(now + frameStep, target)
        const batch = pending
        pending = []
        for (const cb of batch) cb(now)
      }
    },
    restore(): void {
      ;(globalThis as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = origRaf
      ;(globalThis as { performance: Performance }).performance = origPerf as Performance
    },
  }
}

function findOpenTile(world: ReturnType<typeof createInitialWorld>, away: Pos): Pos {
  // Pick the closest walkable tile that's at least 2 away from `away` and not occupied.
  const { floor } = world
  let best: Pos | null = null
  let bestD = Infinity
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const t = floor.tiles[y * floor.width + x]
      if (t !== Tile.Floor) continue
      const d = Math.abs(x - away.x) + Math.abs(y - away.y)
      if (d < 2) continue
      if (d > 6) continue
      const occupied = Object.values(world.actors).some(a => a.alive && a.pos.x === x && a.pos.y === y)
      if (occupied) continue
      if (d < bestD) { bestD = d; best = { x, y } }
    }
  }
  if (!best) throw new Error('no nearby open tile')
  return best
}

describe('loop hero click - phase 1g regression', () => {
  it('hero moves after first click on game start', () => {
    const timer = mockTimer()
    try {
      const world = createInitialWorld('hero-click-test')
      const heroStart = world.actors[world.heroId].pos
      const goal = findOpenTile(world, heroStart)

      const bus = createFxBus()
      let frames = 0
      const loop = createLoop(world, bus, () => { frames++ }, { enemyTickMs: 300 })
      loop.start()

      // Let a few frames pass before clicking — emulates user reaction time.
      timer.advance(50)

      // Player clicks an open tile.
      const action = intentForClick(loop.getState(), goal)
      expect(action).not.toBeNull()
      loop.submit(action!)

      // Run for 2 seconds of game time. Hero should move at least once.
      timer.advance(2000)

      const finalHero = loop.getState().actors[loop.getState().heroId]
      const moved = finalHero.pos.x !== heroStart.x || finalHero.pos.y !== heroStart.y
      expect(moved).toBe(true)
      expect(frames).toBeGreaterThan(10)
    } finally {
      timer.restore()
    }
  })

  it('hero moves with click delayed past initial hero turn', () => {
    const timer = mockTimer()
    try {
      const world = createInitialWorld('hero-delayed-click')
      const heroStart = world.actors[world.heroId].pos
      const goal = findOpenTile(world, heroStart)

      const bus = createFxBus()
      const loop = createLoop(world, bus, () => {}, { enemyTickMs: 300 })
      loop.start()

      // Wait long enough that the loop has rotated past hero (multiple full cycles).
      timer.advance(900)

      const action = intentForClick(loop.getState(), goal)
      expect(action).not.toBeNull()
      loop.submit(action!)

      // Then run for 2 seconds.
      timer.advance(2000)

      const finalHero = loop.getState().actors[loop.getState().heroId]
      const moved = finalHero.pos.x !== heroStart.x || finalHero.pos.y !== heroStart.y
      expect(moved).toBe(true)
    } finally {
      timer.restore()
    }
  })

  it('rotation never skips an actor in pure-idle play (no double TurnAdvance)', () => {
    // Regression: planner / chase used to return TurnAdvance as "pass".
    // Combined with the loop's unconditional TurnAdvance per tick, that double-advanced
    // the rotation, permanently skipping every other actor — including the hero.
    const timer = mockTimer()
    try {
      const world = createInitialWorld('rotation-no-skip')
      const bus = createFxBus()
      const turnIndices: number[] = []
      const loop = createLoop(world, bus, () => {}, {
        enemyTickMs: 300,
        onAction(a, s) {
          if (a.type === 'TurnAdvance') turnIndices.push(s.turnIndex)
        },
      })
      loop.start()
      timer.advance(2000)

      // Each TurnAdvance must move idx by exactly 1 (mod alive count). Never skip.
      const aliveCount = Object.values(loop.getState().actors).filter(a => a.alive).length
      for (let i = 1; i < turnIndices.length; i++) {
        const prev = turnIndices[i - 1]
        const cur = turnIndices[i]
        const expected = (prev + 1) % aliveCount
        expect(cur).toBe(expected)
      }
    } finally {
      timer.restore()
    }
  })

  it('hero moves when click happens mid-frame after initial idle', () => {
    const timer = mockTimer()
    try {
      const world = createInitialWorld('hero-mid-frame')
      const heroStart = world.actors[world.heroId].pos
      const goal = findOpenTile(world, heroStart)

      const bus = createFxBus()
      const loop = createLoop(world, bus, () => {}, { enemyTickMs: 300 })
      loop.start()

      // Click 200ms in — hero hasn't moved (no intent), turn rotation has run.
      timer.advance(200)
      const action = intentForClick(loop.getState(), goal)
      loop.submit(action!)

      timer.advance(1500)

      const finalHero = loop.getState().actors[loop.getState().heroId]
      const moved = finalHero.pos.x !== heroStart.x || finalHero.pos.y !== heroStart.y
      expect(moved).toBe(true)
    } finally {
      timer.restore()
    }
  })
})
