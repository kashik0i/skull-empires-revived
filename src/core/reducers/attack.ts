import type { World, Action, Pos } from '../types'

export function attackActor(state: World, action: Extract<Action, { type: 'AttackActor' }>): World {
  const attacker = state.actors[action.attackerId]
  const target = state.actors[action.targetId]
  if (!attacker || !target || !attacker.alive || !target.alive) return state
  if (!adjacent(attacker.pos, target.pos)) return state
  const dmg = Math.max(1, attacker.atk - target.def)
  const hp = target.hp - dmg
  const alive = hp > 0
  return {
    ...state,
    actors: {
      ...state.actors,
      [target.id]: { ...target, hp, alive },
    },
  }
}

function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}
