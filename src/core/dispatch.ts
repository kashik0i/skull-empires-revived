import type { Action, World } from './types'
import { rootReducer } from './reducers'
import { appendLog } from './log'
import type { FxBus } from '../render/fx/bus'

export function dispatch(state: World, action: Action): World {
  const next = rootReducer(state, action)
  if (next === state) return state
  const text = describeAction(action, next)
  return { ...next, log: appendLog(next.log, { tick: next.tick, text }) }
}

export function dispatchWithFx(state: World, action: Action, bus: FxBus): World {
  const next = rootReducer(state, action)
  if (next === state) return state
  publishDiff(state, next, action, bus)
  const text = describeAction(action, next)
  return { ...next, log: appendLog(next.log, { tick: next.tick, text }) }
}

function publishDiff(prev: World, next: World, action: Action, bus: FxBus): void {
  switch (action.type) {
    case 'MoveActor': {
      const before = prev.actors[action.actorId]
      const after = next.actors[action.actorId]
      if (!before || !after) return
      bus.publish({ kind: 'moved', actorId: action.actorId, from: before.pos, to: after.pos })
      return
    }
    case 'AttackActor': {
      const attacker = prev.actors[action.attackerId]
      const beforeTarget = prev.actors[action.targetId]
      const afterTarget = next.actors[action.targetId]
      if (!attacker || !beforeTarget || !afterTarget) return
      bus.publish({
        kind: 'attacked',
        attackerId: action.attackerId,
        targetId: action.targetId,
        attackerPos: attacker.pos,
        targetPos: beforeTarget.pos,
      })
      const dmg = beforeTarget.hp - afterTarget.hp
      if (dmg > 0) {
        bus.publish({
          kind: 'damaged',
          targetId: action.targetId,
          amount: dmg,
          pos: beforeTarget.pos,
          isHero: beforeTarget.id === prev.heroId,
        })
      }
      if (!afterTarget.alive && beforeTarget.alive) {
        bus.publish({
          kind: 'died',
          actorId: action.targetId,
          pos: beforeTarget.pos,
          archetype: beforeTarget.archetype,
        })
      }
      return
    }
    case 'RunEnd':
      bus.publish({ kind: 'run-ended', outcome: action.outcome })
      return
    case 'Restart':
    case 'TurnAdvance':
    case 'SetHeroIntent':
      return
  }
}

function describeAction(action: Action, state: World): string {
  switch (action.type) {
    case 'MoveActor': {
      const actor = state.actors[action.actorId]
      return `${actor?.archetype ?? action.actorId} moves to (${action.to.x},${action.to.y})`
    }
    case 'AttackActor': {
      const a = state.actors[action.attackerId]
      const t = state.actors[action.targetId]
      return `${a?.archetype ?? action.attackerId} attacks ${t?.archetype ?? action.targetId}`
    }
    case 'TurnAdvance': return `turn advance (tick ${state.tick})`
    case 'RunEnd': return `run ended: ${action.outcome}`
    case 'Restart': return `restart with seed ${action.seed}`
    case 'SetHeroIntent': return action.intent
      ? `hero intent: ${action.intent.kind === 'attack' ? `attack ${action.intent.targetId}` : `move to (${action.intent.goal.x},${action.intent.goal.y})`}`
      : 'hero intent: cleared'
  }
}
