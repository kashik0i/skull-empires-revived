import { Tile, type World, type Action, type ActorId, type Pos } from '../../core/types'

export function chaseHero(state: World, actorId: ActorId): Action {
  const actor = state.actors[actorId]
  const hero = state.actors[state.heroId]
  if (!actor || !actor.alive || !hero || !hero.alive) return { type: 'TurnAdvance' }
  if (manhattan(actor.pos, hero.pos) === 1) {
    return { type: 'AttackActor', attackerId: actorId, targetId: state.heroId }
  }
  const step = greedyStep(state, actor.pos, hero.pos, actorId)
  if (step) return { type: 'MoveActor', actorId, to: step }
  return { type: 'TurnAdvance' }
}

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function greedyStep(state: World, from: Pos, to: Pos, self: ActorId): Pos | null {
  const candidates: Pos[] = []
  if (to.x !== from.x) candidates.push({ x: from.x + Math.sign(to.x - from.x), y: from.y })
  if (to.y !== from.y) candidates.push({ x: from.x, y: from.y + Math.sign(to.y - from.y) })
  for (const p of candidates) {
    if (!inBounds(state, p)) continue
    if (state.floor.tiles[p.y * state.floor.width + p.x] !== Tile.Floor) continue
    if (isOccupied(state, p, self)) continue
    return p
  }
  return null
}

function inBounds(state: World, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < state.floor.width && p.y < state.floor.height
}

function isOccupied(state: World, p: Pos, ignore: ActorId): boolean {
  for (const id in state.actors) {
    if (id === ignore) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === p.x && a.pos.y === p.y) return true
  }
  return false
}
