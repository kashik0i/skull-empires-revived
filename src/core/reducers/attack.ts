import type { World, Action, Actor, Pos, DroppedItem, DroppedItemInstance, LegacyItemKind } from '../types'
import { nextFloat, nextU32 } from '../rng'
import { itemPoolForDepth } from '../../content/itemLoader'

const DROP_CHANCE = 0.4
const DROP_POOL: readonly LegacyItemKind[] = ['flask-red', 'flask-yellow', 'flask-blue']

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

  // On kill: hero only, non-boss enemies drop loot. Boss drops nothing
  // (kill-all on boss floor is the win condition; items would be unused).
  let rng = state.rng
  let droppedItems = state.droppedItems
  if (!alive && target.kind === 'enemy' && attacker.kind === 'hero' && !isBossArchetype(target.archetype)) {
    const roll = nextFloat(rng)
    rng = roll.state
    if (roll.value < DROP_CHANCE) {
      const pick = nextFloat(rng)
      rng = pick.state
      const kind = DROP_POOL[Math.floor(pick.value * DROP_POOL.length)]
      const item: DroppedItem = {
        id: `item-${state.tick}-${target.id}`,
        kind,
        pos: target.pos,
      }
      droppedItems = [...droppedItems, item]
    }
  }

  // New item system: 25% drop on any hero kill of an enemy (including bosses).
  let nextRng = rng
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
    droppedItems,
    groundItems,
  }
}

function isBossArchetype(archetype: string): boolean {
  return archetype === 'skull-emperor'
}

function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}
