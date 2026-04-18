import type { World, Action, Item } from '../core/types'

export type InventoryMount = {
  root: HTMLElement
  update(state: World): void
}

export function mountInventory(equipSlot: HTMLElement, invSlot: HTMLElement, onAction: (a: Action) => void): InventoryMount {
  // Equipment row (2 slots side by side)
  const equipRow = document.createElement('div')
  Object.assign(equipRow.style, { display: 'flex', gap: '6px', justifyContent: 'center' } satisfies Partial<CSSStyleDeclaration>)
  equipSlot.appendChild(equipRow)

  // Inventory grid (2 rows × 3 cols)
  const invGrid = document.createElement('div')
  Object.assign(invGrid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  } satisfies Partial<CSSStyleDeclaration>)
  invSlot.appendChild(invGrid)

  let lastKey = ''

  function makeSlot(label: string): { el: HTMLDivElement; setItem(item: Item | null): void; onClick(cb: () => void): void } {
    const el = document.createElement('div')
    Object.assign(el.style, {
      width: '52px', height: '52px',
      border: '1px solid #5a3e8a',
      borderRadius: '6px',
      background: 'rgba(11, 6, 18, 0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'ui-monospace, monospace', fontSize: '10px',
      color: '#c9b3e8',
      cursor: 'pointer',
      textAlign: 'center',
      padding: '2px',
    } satisfies Partial<CSSStyleDeclaration>)
    let onClickCb: (() => void) | null = null
    el.addEventListener('mousedown', e => { e.preventDefault(); onClickCb?.() })
    return {
      el,
      setItem(item) {
        el.title = item ? item.name : `(${label})`
        el.textContent = item ? item.name.slice(0, 6) : ''
      },
      onClick(cb) { onClickCb = cb },
    }
  }

  const weaponSlot = makeSlot('weapon')
  const armorSlot = makeSlot('armor')
  equipRow.appendChild(weaponSlot.el)
  equipRow.appendChild(armorSlot.el)

  const invSlots = Array.from({ length: 6 }, () => makeSlot(''))
  for (const s of invSlots) invGrid.appendChild(s.el)

  function update(state: World): void {
    const key = JSON.stringify({
      w: state.equipment.weapon?.instanceId ?? '',
      a: state.equipment.armor?.instanceId ?? '',
      inv: state.inventory.map(i => i.instanceId),
    })
    if (key === lastKey) return
    lastKey = key

    weaponSlot.setItem(state.equipment.weapon)
    weaponSlot.onClick(() => { if (state.equipment.weapon) onAction({ type: 'UnequipItem', slot: 'weapon' }) })
    armorSlot.setItem(state.equipment.armor)
    armorSlot.onClick(() => { if (state.equipment.armor) onAction({ type: 'UnequipItem', slot: 'armor' }) })

    for (let i = 0; i < 6; i++) {
      const item = state.inventory[i] ?? null
      invSlots[i].setItem(item)
      invSlots[i].onClick(() => {
        if (!item) return
        if (item.body.kind === 'potion') onAction({ type: 'UseItem', instanceId: item.instanceId })
        else onAction({ type: 'EquipItem', instanceId: item.instanceId })
      })
    }
  }

  return { root: equipSlot, update }
}
