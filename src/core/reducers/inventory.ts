import type { World, Action, EquipmentSlot } from '../types'
import { instantiateItem } from '../../content/itemLoader'

const INVENTORY_MAX = 6

type UseAction = Extract<Action, { type: 'UseItem' }>
type EquipAction = Extract<Action, { type: 'EquipItem' }>
type UnequipAction = Extract<Action, { type: 'UnequipItem' }>
type PickupAction = Extract<Action, { type: 'PickupItem' }>

export function useItem(state: World, action: UseAction): World {
  const idx = state.inventory.findIndex(it => it.instanceId === action.instanceId)
  if (idx < 0) return state
  const item = state.inventory[idx]
  if (item.body.kind !== 'potion') return state

  const hero = state.actors[state.heroId]
  if (!hero) return state

  let nextHero = hero
  const eff = item.body.effect
  if (eff.type === 'heal') {
    nextHero = { ...hero, hp: Math.min(hero.maxHp, hero.hp + eff.amount) }
  } else if (eff.type === 'buff-atk') {
    nextHero = { ...hero, statusEffects: [...hero.statusEffects, { kind: 'buff-atk', amount: eff.amount, remainingTicks: eff.durationTicks }] }
  } else if (eff.type === 'buff-def') {
    nextHero = { ...hero, statusEffects: [...hero.statusEffects, { kind: 'buff-def', amount: eff.amount, remainingTicks: eff.durationTicks }] }
  }

  return {
    ...state,
    inventory: state.inventory.filter((_, i) => i !== idx),
    actors: { ...state.actors, [state.heroId]: nextHero },
  }
}

export function equipItem(state: World, action: EquipAction): World {
  const idx = state.inventory.findIndex(it => it.instanceId === action.instanceId)
  if (idx < 0) return state
  const item = state.inventory[idx]
  if (item.body.kind !== 'weapon' && item.body.kind !== 'armor') return state

  const slot: EquipmentSlot = item.body.kind === 'weapon' ? 'weapon' : 'armor'
  const previous = state.equipment[slot]

  const newInv = state.inventory.slice()
  newInv.splice(idx, 1)
  if (previous) newInv.splice(idx, 0, previous)

  return {
    ...state,
    inventory: newInv,
    equipment: { ...state.equipment, [slot]: item },
  }
}

export function unequipItem(state: World, action: UnequipAction): World {
  const equipped = state.equipment[action.slot]
  if (!equipped) return state
  if (state.inventory.length >= INVENTORY_MAX) return state
  return {
    ...state,
    inventory: [...state.inventory, equipped],
    equipment: { ...state.equipment, [action.slot]: null },
  }
}

export function pickupItem(state: World, action: PickupAction): World {
  const ground = state.groundItems.find(g => g.instanceId === action.instanceId)
  if (!ground) return state
  if (state.inventory.length >= INVENTORY_MAX) return state
  const item = instantiateItem(ground.itemId, ground.instanceId)
  return {
    ...state,
    inventory: [...state.inventory, item],
    groundItems: state.groundItems.filter(g => g.instanceId !== ground.instanceId),
  }
}
