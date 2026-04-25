import { Tile, type Action, type ActorId, type Pos, type World } from '../core/types'
import { firstStepToward, fullPathToward, manhattan } from './pathfind'

/**
 * Resolve the hero's action(s) for the current turn based on world state + hero intent.
 *
 * Returns an array of actions to apply (zero, one, or two — e.g. SetHeroPath + MoveActor).
 *
 * Rules:
 *   1. Player intent wins when it can produce progress — move along path, swing at adjacent target, etc.
 *   2. Auto-defend whenever the hero would otherwise idle: no intent, OR intent dead-ended this turn.
 *      A dead-ended intent is cleared and the same turn is spent attacking an adjacent enemy.
 *   3. No intent, no threat: return [] (hero idles).
 */
export function resolveHeroActions(state: World): Action[] {
  const hero = state.actors[state.heroId]
  if (!hero || !hero.alive) return []

  const intent = state.heroIntent
  if (!intent) return defendOrIdle(state, hero.pos, hero.id)

  if (intent.kind === 'interact') {
    const target = state.actors[intent.targetId]
    if (!target || !target.alive) return clearAndDefend(state, hero.pos, hero.id)
    if (manhattan(hero.pos, target.pos) === 1) {
      return [
        { type: 'OpenMerchantDialog', merchantId: target.id },
        { type: 'SetHeroIntent', intent: null },
      ]
    }
    // Step toward target; pass through any NPC tile so BFS can reach adjacent.
    const step = firstStepToward(state, hero.pos, target.pos, { passThroughActors: npcIds(state) })
    if (!step) return clearAndDefend(state, hero.pos, hero.id)
    return [{ type: 'MoveActor', actorId: hero.id, to: step }]
  }

  if (intent.kind === 'attack') {
    const target = state.actors[intent.targetId]
    if (!target || !target.alive) return clearAndDefend(state, hero.pos, hero.id)
    // Already adjacent — swing instead of trying to step onto the target's tile.
    if (manhattan(hero.pos, target.pos) === 1) {
      return [{ type: 'AttackActor', attackerId: hero.id, targetId: target.id }]
    }
    // No caching: target moves, path may change each turn.
    const path = fullPathToward(state, hero.pos, target.pos, { passThroughActors: [target.id, ...npcIds(state)] })
    if (!path || path.length === 0) return clearAndDefend(state, hero.pos, hero.id)
    return [{ type: 'MoveActor', actorId: hero.id, to: path[0] }]
  }

  if (intent.kind === 'move-to') {
    if (hero.pos.x === intent.goal.x && hero.pos.y === intent.goal.y) {
      return clearAndDefend(state, hero.pos, hero.id)
    }
    // Try the cached path first.
    if (state.heroPath.length > 0) {
      const next = state.heroPath[0]
      if (isStepValid(state, next, hero.id)) {
        return [
          { type: 'SetHeroPath', path: state.heroPath.slice(1) },
          { type: 'MoveActor', actorId: hero.id, to: next },
        ]
      }
    }
    // Cache missing or blocked — recompute. NPCs are pass-through so a merchant never strands the hero.
    const path = fullPathToward(state, hero.pos, intent.goal, { passThroughActors: npcIds(state) })
    if (!path || path.length === 0) return clearAndDefend(state, hero.pos, hero.id)
    return [
      { type: 'SetHeroPath', path: path.slice(1) },
      { type: 'MoveActor', actorId: hero.id, to: path[0] },
    ]
  }

  return []
}

function defendOrIdle(state: World, pos: Pos, heroId: ActorId): Action[] {
  const adj = findAdjacentEnemy(state, pos)
  return adj ? [{ type: 'AttackActor', attackerId: heroId, targetId: adj }] : []
}

function clearAndDefend(state: World, pos: Pos, heroId: ActorId): Action[] {
  const adj = findAdjacentEnemy(state, pos)
  if (adj) {
    return [
      { type: 'SetHeroIntent', intent: null },
      { type: 'AttackActor', attackerId: heroId, targetId: adj },
    ]
  }
  return [{ type: 'SetHeroIntent', intent: null }]
}

/** Back-compat wrapper for tests that still expect a single action. */
export function resolveHeroAction(state: World): Action | null {
  const actions = resolveHeroActions(state)
  if (actions.length === 0) return null
  // Tests care about the "effective" action (move/attack/clear), not the path update.
  return actions[actions.length - 1]
}

function findAdjacentEnemy(state: World, pos: Pos): ActorId | null {
  let best: ActorId | null = null
  let bestHp = Infinity
  for (const id in state.actors) {
    const a = state.actors[id]
    if (a.kind !== 'enemy' || !a.alive) continue
    if (manhattan(a.pos, pos) !== 1) continue
    if (a.hp < bestHp) {
      bestHp = a.hp
      best = id
    }
  }
  return best
}

function isStepValid(state: World, step: Pos, heroId: ActorId): boolean {
  const { floor } = state
  if (step.x < 0 || step.y < 0 || step.x >= floor.width || step.y >= floor.height) return false
  const t = floor.tiles[step.y * floor.width + step.x]
  if (t !== Tile.Floor && t !== Tile.Stairs && t !== Tile.Shrine) return false
  for (const id in state.actors) {
    if (id === heroId) continue
    const a = state.actors[id]
    if (!a.alive) continue
    if (a.pos.x !== step.x || a.pos.y !== step.y) continue
    if (a.kind === 'npc') continue // NPCs allow swap-past on move
    return false
  }
  return true
}

function npcIds(state: World): ActorId[] {
  const ids: ActorId[] = []
  for (const id in state.actors) {
    const a = state.actors[id]
    if (a.kind === 'npc' && a.alive) ids.push(id)
  }
  return ids
}
