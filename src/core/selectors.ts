import type { World, ActorId } from './types'

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

export function effectiveAtk(state: World, actorId: ActorId): number {
  const actor = state.actors[actorId]
  if (!actor) return 0
  let total = actor.atk
  if (actorId === state.heroId && state.equipment.weapon?.body.kind === 'weapon') {
    total += state.equipment.weapon.body.atk
  }
  for (const e of actor.statusEffects) {
    if (e.kind === 'buff-atk') total += e.amount
  }
  return total
}

export function effectiveDef(state: World, actorId: ActorId): number {
  const actor = state.actors[actorId]
  if (!actor) return 0
  let total = actor.def
  if (actorId === state.heroId && state.equipment.armor?.body.kind === 'armor') {
    total += state.equipment.armor.body.def
  }
  for (const e of actor.statusEffects) {
    if (e.kind === 'buff-def') total += e.amount
  }
  return total
}
