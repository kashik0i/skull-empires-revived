import { Tile, type World, type Action, type ActorId, type Pos } from '../types'

export function moveActor(state: World, action: Extract<Action, { type: 'MoveActor' }>): World {
  const actor = state.actors[action.actorId]
  if (!actor || !actor.alive) return state
  if (!isAdjacent(actor.pos, action.to)) return state
  if (!isWalkable(state, action.to)) return state
  if (isOccupied(state, action.to, action.actorId)) return state
  return {
    ...state,
    actors: {
      ...state.actors,
      [action.actorId]: { ...actor, pos: action.to },
    },
  }
}

function isAdjacent(a: Pos, b: Pos): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return dx + dy === 1
}

function isWalkable(state: World, p: Pos): boolean {
  const { floor } = state
  if (p.x < 0 || p.y < 0 || p.x >= floor.width || p.y >= floor.height) return false
  return floor.tiles[p.y * floor.width + p.x] === Tile.Floor
}

function isOccupied(state: World, p: Pos, ignore: ActorId): boolean {
  for (const id in state.actors) {
    if (id === ignore) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === p.x && a.pos.y === p.y) return true
  }
  return false
}
