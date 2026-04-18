import type { World, Action } from '../types'
import { Tile } from '../types'
import { listCardIds, getCard } from '../../content/cardLoader'
import { nextU32 } from '../rng'

type OpenMerchantAction = Extract<Action, { type: 'OpenMerchantDialog' }>
type MerchantTradeAction = Extract<Action, { type: 'MerchantTrade' }>
type ResolveShrineAction = Extract<Action, { type: 'ResolveShrine' }>

export function clearDialog(state: World): World {
  if (state.pendingDialog === null) return state
  return { ...state, pendingDialog: null }
}

export function openMerchantDialog(state: World, action: OpenMerchantAction): World {
  const merchant = state.actors[action.merchantId]
  if (!merchant || merchant.kind !== 'npc') return state

  // Fisher-Yates shuffle of card pool using world rng; take first 3.
  const pool = listCardIds().slice()
  let rng = state.rng
  for (let i = pool.length - 1; i > 0; i--) {
    const r = nextU32(rng)
    rng = r.state
    const j = r.value % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const choices = pool.slice(0, 3)

  const dialog = {
    title: 'Grim the Wanderer',
    body: 'He sets his wares down and nods.',
    actions: choices.map(cardId => ({
      label: getCard(cardId).name,
      resolve: { type: 'MerchantTrade' as const, cardId, merchantId: merchant.id },
    })),
  }

  return { ...state, rng, pendingDialog: dialog }
}

export function merchantTrade(state: World, action: MerchantTradeAction): World {
  const merchant = state.actors[action.merchantId]
  if (!merchant || merchant.kind !== 'npc') return state
  const actors = { ...state.actors }
  delete actors[action.merchantId]
  return {
    ...state,
    actors,
    turnOrder: state.turnOrder.filter(id => id !== action.merchantId),
    pendingDialog: null,
    run: {
      ...state.run,
      cards: {
        ...state.run.cards,
        // Drop straight into the hand so the bought card is playable right now —
        // routing it through the deck means it might not surface until many turns later.
        hand: [...state.run.cards.hand, action.cardId],
      },
    },
  }
}

export function resolveShrine(state: World, action: ResolveShrineAction): World {
  const heroId = state.heroId
  const hero = state.actors[heroId]
  if (!hero) return state

  let nextHero = hero
  if (action.choice === 'blood') {
    nextHero = { ...hero, maxHp: hero.maxHp + 2, hp: hero.hp + 2 }
  } else {
    nextHero = { ...hero, atk: hero.atk + 1 }
  }

  const newTiles = new Uint8Array(state.floor.tiles)
  newTiles[action.pos.y * state.floor.width + action.pos.x] = Tile.Floor

  return {
    ...state,
    actors: { ...state.actors, [heroId]: nextHero },
    floor: { ...state.floor, tiles: newTiles },
  }
}
