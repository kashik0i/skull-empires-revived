import type { World, Action, Actor, Pos, DroppedItemInstance } from '../types'
import { nextU32 } from '../rng'
import { itemPoolForDepth } from '../../content/itemLoader'

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
  if (target.kind === 'npc') return state
  if (!adjacent(attacker.pos, target.pos)) return state

  const effectiveAtk = attacker.atk + buffAtkBonus(attacker)
  const effDef = effectiveDef(target)
  const dmg = Math.max(1, effectiveAtk - effDef)
  const hp = target.hp - dmg
  const alive = hp > 0

  // 25% drop on hero kill of any enemy (bosses included). Picks from the
  // depth-tier pool. RNG threaded through so replay is deterministic.
  let nextRng = state.rng
  let groundItems = state.groundItems
  if (!alive && attacker.kind === 'hero' && target.kind === 'enemy') {
    const r1 = nextU32(nextRng); nextRng = r1.state
    if (r1.value % 100 < 25) {
      const pool = itemPoolForDepth(state.run.depth)
      const r2 = nextU32(nextRng); nextRng = r2.state
      const itemId = pool[r2.value % pool.length]
      const r3 = nextU32(nextRng); nextRng = r3.state
      const drop: DroppedItemInstance = {
        instanceId: `drop-${state.tick}-${r3.value}`,
        itemId,
        pos: target.pos,
      }
      groundItems = [...groundItems, drop]
    }
  }

  return {
    ...state,
    actors: {
      ...state.actors,
      [target.id]: { ...target, hp, alive },
    },
    rng: nextRng,
    groundItems,
  }
}

function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}
