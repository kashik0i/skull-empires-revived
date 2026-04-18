import raw from './items.json'
import type { Item } from '../core/types'

type ItemDef = Omit<Item, 'instanceId'>

const defs: readonly ItemDef[] = raw as readonly ItemDef[]
const byId: Record<string, ItemDef> = Object.fromEntries(defs.map(d => [d.id, d]))

export function getItemDef(id: string): ItemDef {
  const d = byId[id]
  if (!d) throw new Error(`unknown item id: ${id}`)
  return d
}

export function listItemIds(): readonly string[] {
  return defs.map(d => d.id)
}

/** Build an Item with a fresh instanceId. */
export function instantiateItem(id: string, instanceId: string): Item {
  return { ...getItemDef(id), instanceId }
}

/** Depth-tier pool: floor 1-2 commons; 3 mids; 4-5 highs. */
export function itemPoolForDepth(depth: number): readonly string[] {
  const commons = ['heal-small', 'rusty-blade', 'cloth-rags']
  const mids = [...commons, 'strength-tonic', 'iron-tonic', 'iron-blade', 'leather-vest']
  const highs = [...mids, 'heal-large', 'ember-blade', 'plate-mail']
  if (depth <= 2) return commons
  if (depth === 3) return mids
  return highs
}
