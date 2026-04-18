import type { World, Action } from '../types'
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
    run: {
      ...state.run,
      cards: {
        ...state.run.cards,
        deck: [...state.run.cards.deck, action.cardId],
      },
    },
  }
}

export function resolveShrine(state: World, _action: ResolveShrineAction): World {
  return state
}
