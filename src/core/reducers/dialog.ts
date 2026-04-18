import type { World, Action } from '../types'
import { Tile } from '../types'
import { getItemDef, instantiateItem, itemPoolForDepth } from '../../content/itemLoader'
import { shuffleWithRng } from '../state'
import { nextU32 } from '../rng'

type OpenMerchantAction = Extract<Action, { type: 'OpenMerchantDialog' }>
type ResolveShrineAction = Extract<Action, { type: 'ResolveShrine' }>

export function clearDialog(state: World): World {
  if (state.pendingDialog === null) return state
  return { ...state, pendingDialog: null }
}

export function openMerchantDialog(state: World, action: OpenMerchantAction): World {
  const merchant = state.actors[action.merchantId]
  if (!merchant || merchant.kind !== 'npc') return state

  const pool = itemPoolForDepth(state.run.depth).slice()
  const { result: shuffled, rng } = shuffleWithRng(pool, state.rng)
  const choices = shuffled.slice(0, 3)

  const dialog = {
    title: 'Grim the Wanderer',
    body: 'He sets his wares down and nods.',
    actions: choices.map(itemId => ({
      label: getItemDef(itemId).name,
      resolve: { type: 'MerchantBuyItem' as const, itemId, merchantId: merchant.id },
    })),
  }
  return { ...state, rng, pendingDialog: dialog }
}

export function merchantBuyItem(state: World, action: Extract<Action, { type: 'MerchantBuyItem' }>): World {
  const merchant = state.actors[action.merchantId]
  if (!merchant || merchant.kind !== 'npc') return state
  if (state.inventory.length >= 6) {
    // Inventory full — close dialog without buying.
    return { ...state, pendingDialog: null }
  }
  const r = nextU32(state.rng)
  const item = instantiateItem(action.itemId, `bought-${state.tick}-${r.value}`)
  const actors = { ...state.actors }
  delete actors[action.merchantId]
  return {
    ...state,
    rng: r.state,
    actors,
    turnOrder: state.turnOrder.filter(id => id !== action.merchantId),
    pendingDialog: null,
    inventory: [...state.inventory, item],
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
