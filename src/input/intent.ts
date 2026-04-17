import type { Action, Pos, World } from '../core/types'

export function intentForClick(state: World, tile: Pos): Action | null {
  const hero = state.actors[state.heroId]
  if (!hero || !hero.alive) return null
  const dx = tile.x - hero.pos.x
  const dy = tile.y - hero.pos.y
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null
  for (const id in state.actors) {
    if (id === state.heroId) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === tile.x && a.pos.y === tile.y) {
      return { type: 'AttackActor', attackerId: state.heroId, targetId: id }
    }
  }
  return { type: 'MoveActor', actorId: state.heroId, to: tile }
}
