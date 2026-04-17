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
  const currentDist = manhattan(from, to)
  const neighbors: Pos[] = [
    { x: from.x + 1, y: from.y },
    { x: from.x - 1, y: from.y },
    { x: from.x, y: from.y + 1 },
    { x: from.x, y: from.y - 1 },
  ]
  const passable = neighbors.filter(p =>
    inBounds(state, p) &&
    state.floor.tiles[p.y * state.floor.width + p.x] === Tile.Floor &&
    !isOccupied(state, p, self)
  )
  const scored = passable
    .map(p => ({ p, d: manhattan(p, to) }))
    .filter(c => c.d <= currentDist + 1)
    .sort((a, b) => a.d - b.d)
  return scored[0]?.p ?? null
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
