import type { World, Action, Item } from '../core/types'
import { drawSprite } from '../render/sprites'

export type InventoryMount = {
  root: HTMLElement
  update(state: World): void
}

function makeEquipmentIcon(spriteName: string | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  canvas.style.imageRendering = 'pixelated'
  canvas.style.flexShrink = '0'
  const ctx = canvas.getContext('2d')
  if (ctx && spriteName) {
    ctx.imageSmoothingEnabled = false
    drawSprite(ctx, spriteName, 16, 16, 32)
  } else if (ctx) {
    // Empty-slot placeholder: faded outline.
    ctx.strokeStyle = 'rgba(234, 219, 192, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(4, 4, 24, 24)
  }
  return canvas
}

export function mountInventory(equipSlot: HTMLElement, invSlot: HTMLElement, onAction: (a: Action) => void): InventoryMount {
  // Equipment rows (weapon + armor, each as a flex row with icon + label)
  const equipRow = document.createElement('div')
  Object.assign(equipRow.style, { display: 'flex', flexDirection: 'column', gap: '6px' } satisfies Partial<CSSStyleDeclaration>)
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

  type SlotHandle = { el: HTMLDivElement; setItem(item: Item | null): void; onClick(cb: () => void): void }

  function makeSlot(label: string): SlotHandle {
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

  function makeEquipmentRow(slotLabel: string): SlotHandle {
    const el = document.createElement('div')
    Object.assign(el.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      border: '1px solid #5a3e8a',
      borderRadius: '6px',
      background: 'rgba(11, 6, 18, 0.78)',
      padding: '4px 6px',
      cursor: 'pointer',
      minHeight: '40px',
    } satisfies Partial<CSSStyleDeclaration>)

    let iconCanvas = makeEquipmentIcon(null)
    el.appendChild(iconCanvas)

    const label = document.createElement('span')
    Object.assign(label.style, {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '10px',
      color: '#c9b3e8',
    } satisfies Partial<CSSStyleDeclaration>)
    label.textContent = '— empty —'
    el.appendChild(label)

    let onClickCb: (() => void) | null = null
    el.addEventListener('mousedown', e => { e.preventDefault(); onClickCb?.() })

    return {
      el,
      setItem(item) {
        el.title = item ? item.name : `(${slotLabel})`

        // Replace icon canvas with fresh draw
        const newIcon = makeEquipmentIcon(item ? item.sprite : null)
        el.replaceChild(newIcon, iconCanvas)
        iconCanvas = newIcon

        if (item) {
          const stat = item.body.kind === 'weapon'
            ? `+${item.body.atk} atk`
            : item.body.kind === 'armor'
              ? `+${item.body.def} def`
              : ''
          label.textContent = `${item.name}${stat ? ` (${stat})` : ''}`
        } else {
          label.textContent = '— empty —'
        }
      },
      onClick(cb) { onClickCb = cb },
    }
  }

  const weaponSlot = makeEquipmentRow('weapon')
  const armorSlot = makeEquipmentRow('armor')
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
