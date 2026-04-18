import type { World, Action, Actor, StatusEffect } from '../types'
import { getCard } from '../../content/cardLoader'

type PlayCardAction = Extract<Action, { type: 'PlayCard' }>
type OfferCardRewardAction = Extract<Action, { type: 'OfferCardReward' }>
type PickCardRewardAction = Extract<Action, { type: 'PickCardReward' }>

/** Compute effective DEF for an actor, factoring in buff-def / debuff-def status effects. */
function effectiveDef(actor: Actor): number {
  let def = actor.def
  for (const s of actor.statusEffects) {
    if (s.kind === 'buff-def') def += s.amount
    if (s.kind === 'debuff-def') def -= s.amount
  }
  return def
}

/** Apply direct damage to a single actor (respects debuff-def). */
function applyDirectDamage(actor: Actor, rawDamage: number): Actor {
  const effDef = effectiveDef(actor)
  const dmg = Math.max(1, rawDamage - effDef)
  const hp = actor.hp - dmg
  return { ...actor, hp, alive: hp > 0 }
}

export function playCard(state: World, action: PlayCardAction): World {
  const { cardId, targetId } = action

  // Card must be in hand
  if (!state.run.cards.hand.includes(cardId)) return state

  let cardDef
  try {
    cardDef = getCard(cardId)
  } catch {
    return state
  }

  const { effect, target: targetMode } = cardDef

  // Resolve target actor
  let targetActorId: string | undefined
  if (targetMode === 'enemy') {
    if (targetId === undefined) return state
    const idStr = String(targetId)
    const actor = state.actors[idStr]
    if (!actor || actor.kind !== 'enemy' || !actor.alive) return state
    targetActorId = idStr
  } else if (targetMode === 'self') {
    targetActorId = state.heroId
  }
  // targetMode === 'none' → targetActorId stays undefined

  // Apply effect
  let actors = { ...state.actors }
  let revealed = state.revealed

  if (effect.kind === 'heal') {
    const hero = actors[state.heroId]
    const newHp = Math.min(hero.maxHp, hero.hp + effect.amount)
    actors = { ...actors, [state.heroId]: { ...hero, hp: newHp } }
  } else if (effect.kind === 'direct-damage') {
    const target = actors[targetActorId!]
    actors = { ...actors, [targetActorId!]: applyDirectDamage(target, effect.amount) }
  } else if (effect.kind === 'aoe-damage') {
    for (const id of Object.keys(actors)) {
      const a = actors[id]
      if (a.kind === 'enemy' && a.alive) {
        actors = { ...actors, [id]: applyDirectDamage(a, effect.amount) }
      }
    }
  } else if (effect.kind === 'buff-atk') {
    const target = actors[targetActorId!]
    const newEffect: StatusEffect = { kind: 'buff-atk', amount: effect.amount, remainingTicks: effect.durationTicks }
    actors = { ...actors, [targetActorId!]: { ...target, statusEffects: [...target.statusEffects, newEffect] } }
  } else if (effect.kind === 'buff-def') {
    const target = actors[targetActorId!]
    const newEffect: StatusEffect = { kind: 'buff-def', amount: effect.amount, remainingTicks: effect.durationTicks }
    actors = { ...actors, [targetActorId!]: { ...target, statusEffects: [...target.statusEffects, newEffect] } }
  } else if (effect.kind === 'debuff-def') {
    const target = actors[targetActorId!]
    const newEffect: StatusEffect = { kind: 'debuff-def', amount: effect.amount, remainingTicks: effect.durationTicks }
    actors = { ...actors, [targetActorId!]: { ...target, statusEffects: [...target.statusEffects, newEffect] } }
  } else if (effect.kind === 'reveal') {
    revealed = true
  }

  // Move card from hand → discard
  const hand = state.run.cards.hand.filter(id => id !== cardId)
  const discard = [...state.run.cards.discard, cardId]

  return {
    ...state,
    actors,
    revealed,
    run: {
      ...state.run,
      cards: { ...state.run.cards, hand, discard },
    },
  }
}

export function offerCardReward(state: World, action: OfferCardRewardAction): World {
  return {
    ...state,
    phase: 'card_reward',
    run: {
      ...state.run,
      pendingReward: { choices: action.choices },
      rewardedThisFloor: true,
    },
  }
}

export function pickCardReward(state: World, action: PickCardRewardAction): World {
  if (state.run.pendingReward === null) return state

  const deck = [...state.run.cards.deck, action.cardId]

  return {
    ...state,
    phase: 'exploring',
    run: {
      ...state.run,
      pendingReward: null,
      cards: { ...state.run.cards, deck },
    },
  }
}
