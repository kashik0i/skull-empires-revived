import type { World } from './types'

const BOSS_DEPTH = 5

export function runOutcome(state: World): 'won' | 'lost' | null {
  const hero = state.actors[state.heroId]
  if (!hero || !hero.alive) return 'lost'
  let anyEnemyAlive = false
  for (const id in state.actors) {
    const a = state.actors[id]
    if (a.kind === 'enemy' && a.alive) { anyEnemyAlive = true; break }
  }
  if (!anyEnemyAlive && state.run.depth >= BOSS_DEPTH) return 'won'
  return null
}
