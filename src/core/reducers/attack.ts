import type { World, Action, Actor, Pos } from '../types'

/** Sum of buff-atk amounts on an actor's active status effects. */
function buffAtkBonus(actor: Actor): number {
  return actor.statusEffects
    .filter(s => s.kind === 'buff-atk')
    .reduce((sum, s) => sum + s.amount, 0)
}

/** Effective DEF = base def + buff-def amounts - debuff-def amounts. */
function effectiveDef(actor: Actor): number {
  let def = actor.def
  for (const s of actor.statusEffects) {
    if (s.kind === 'buff-def') def += s.amount
    if (s.kind === 'debuff-def') def -= s.amount
  }
  return def
}

export function attackActor(state: World, action: Extract<Action, { type: 'AttackActor' }>): World {
  const attacker = state.actors[action.attackerId]
  const target = state.actors[action.targetId]
  if (!attacker || !target || !attacker.alive || !target.alive) return state
  if (!adjacent(attacker.pos, target.pos)) return state

  const effectiveAtk = attacker.atk + buffAtkBonus(attacker)
  const effDef = effectiveDef(target)
  const dmg = Math.max(1, effectiveAtk - effDef)
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
